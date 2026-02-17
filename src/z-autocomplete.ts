import { LitElement, html, css } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';

interface ZAutocompleteOptionBase {
    label: string | HTMLElement,
    inputValue?: string,
};

export type ZAutocompleteSelectableOption<OptionValue> = ZAutocompleteOptionBase & {
    disabled?: false,
    value: OptionValue,
};

export type ZAutocompleteDisabledOption<OptionValue> = ZAutocompleteOptionBase & {
    disabled: true,
    value?: OptionValue,
};

export type ZAutocompleteOption<OptionValue> = ZAutocompleteSelectableOption<OptionValue> | ZAutocompleteDisabledOption<OptionValue>;

const debounce = <T extends (...args: any[]) => void>(cb: T, delay: number = 1000): T => {
    let timer: number;

    return ((...args: any[]) => {
        clearTimeout(timer);

        timer = setTimeout(() => {
            cb(...args);
        }, delay);
    }) as unknown as T;
};

@customElement('z-autocomplete')
export class ZAutocomplete<OptionValue> extends LitElement {
    // local non reactive properties
    private _abortController?: AbortController;
    private _inputEl!: HTMLInputElement | HTMLTextAreaElement;
    private _clearEl!: HTMLElement;
    private _open: boolean = false;
    private _value?: OptionValue;
    private _options: ZAutocompleteOption<OptionValue>[] = [];

    // bound event handlers for proper removeEventListener
    private _boundOnInput = this._onInput.bind(this);
    private _boundOnKeydown = this._onKeydown.bind(this);
    private _boundOnClear = this._onClear.bind(this);
    private _boundOnFocusOut = this._onFocusOut.bind(this);

    @property({ type: Number })
    public debounceDelay: number = 300;

    // --- slotted dom refs
    @queryAssignedElements({ selector: '[data-z-autocomplete-input]'})
    private _inputEls!: (HTMLInputElement | HTMLTextAreaElement)[]; // | ElementContentEditable;

    @queryAssignedElements({ selector: '[data-z-autocomplete-clear]'})
    private _clearEls!: HTMLElement[];

    // --- shadowDom refs
    @query('[data-z-autocomplete-options]')
    private _optionsEl!: HTMLUListElement;

    // --- attributes, properties, states
    @state()
    private _activeOptionIndex: number = -1;

    // options visibility
    @state()
    set open(val: boolean) {
        this._open = val && !!this.options.length;

        if (!this._open) {
            this._activeOptionIndex = -1;
            this._optionsEl.scrollTo(0, 0);
        }

        this._inputEl.setAttribute('aria-expanded', String(this._open));
    }
    get open() {
        return this._open;
    }

    @property({ attribute: false })
    set value(val: OptionValue | undefined) {
        if (val === this._value) return;

        const autocompleteEvt = this._dispatchAutocompleteEvent(val);

        // only change value when component ready
        // or this._inputEl could be undefined (ex: on initialization, before connectedCallback is finished)
        this.updateComplete.then(() => {
            if (!autocompleteEvt.defaultPrevented) {
                this._value = val;

                // update input value first
                const option = this.dataToOption(val);

                if (option?.inputValue) this._inputEl.value = option.inputValue;
                else if (typeof option?.label === 'string') this._inputEl.value = option.label;
                else if (option?.label instanceof HTMLElement) this._inputEl.value = option.label.textContent ?? '';
                else this._inputEl.value = '';
            } else {
                this._value = undefined;
                this._inputEl.value = '';
            }

            // update others elements
            this.options = [];
            this._updateClearElVisibility();
        });
    }
    get value() {
        return this._value;
    };

    @state()
    set options(val: ZAutocompleteOption<OptionValue>[]) {
        this._options = val.filter(Boolean);
        this.open = !!val.length;
    }
    get options() {
        return this._options;
    }

    // --- lifecycle
    async connectedCallback(): Promise<void> {
        super.connectedCallback();

        // wait for the update to be complete to have more chances to see the input inside the slot dom ...
        await this.updateComplete;

        this._inputEl = this._inputEls[0];
        this._clearEl = this._clearEls[0];

        this._initInputEl();

        // override method for a debounced one.
        this._onInputChange = debounce(this._onInputChange.bind(this), this.debounceDelay);

        this._inputEl.addEventListener('input', this._boundOnInput);
        this._inputEl.addEventListener('keydown', this._boundOnKeydown);
        this.addEventListener('focusout', this._boundOnFocusOut);

        if (this._clearEl) {
            this._initClearEl();
            this._clearEl.addEventListener('click', this._boundOnClear);
        }
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._abortController?.abort('ZAutocomplete is being destroyed');

        this._inputEl.removeEventListener('input', this._boundOnInput);
        this._inputEl.removeEventListener('keydown', this._boundOnKeydown);
        this.removeEventListener('focusout', this._boundOnFocusOut);

        if (this._clearEl) this._clearEl.removeEventListener('click', this._boundOnClear);
    }

    // --- render methods
    static styles = css`
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
    `;

    render() {
        return html`
            <slot></slot>

            <ul
                data-z-autocomplete-options
                part="options-list"
                role="listbox"
                tabindex="-1"
                @mousedown=${(e: Event) => e.preventDefault()}
                ?hidden=${!this.open}>
                ${this.options.map((option, index) => this._renderOption(option, index))}
            </ul>
        `;
    }

    private _renderOption(option: ZAutocompleteOption<OptionValue>, index: number) {
        const partsMap = {
            'options-item': true,
            'options-item--active': index === this._activeOptionIndex,
            'options-item--disabled': !!option.disabled,
        };

        const parts = Object.entries(partsMap).reduce((acc, [part, add]) => (add ? `${acc} ${part}` : acc), '').trim();

        return html`
            <li
                part=${parts}
                data-index="${index}"
                aria-selected="${index === this._activeOptionIndex}"
                .aria-disabled="${!!option.disabled}"
                role="option"
                @click=${() => this._selectOption(option)}>
                ${option.label}
            </li>
        `
    }

    // --- private methods
    private _dispatchAutocompleteEvent(val: OptionValue | undefined): CustomEvent {
        const autocompleteEvt = new CustomEvent('autocomplete', {
            detail: val,
            bubbles: true,
            composed: true,
            cancelable: true,
        });

        this.dispatchEvent(autocompleteEvt);
        return autocompleteEvt;
    }

    private _initInputEl(): void {
        if(!this._inputEl) throw new Error('ZAutocomplete : No [data-z-autocomplete-input] element provided to take control on');

        this._inputEl.setAttribute('role', 'combobox');
        this._inputEl.setAttribute('aria-expanded', 'false');
        this._inputEl.setAttribute('aria-autocomplete', 'list');
        this._inputEl.setAttribute('aria-haspopup', 'listbox');
        this._inputEl.setAttribute('autocomplete', 'off');
        this._inputEl.setAttribute('spellcheck', 'false');
    }

    private _initClearEl(): void {
        this._clearEl.setAttribute('type', 'button');
        this._updateClearElVisibility();
    }

    private _onClear() {
        this._abortController?.abort('ZAutocomplete [data-z-autocomplete-input] has been cleared.');
        this._inputEl.value = '';
        this.options = [];
        this.value = undefined;
        this._updateClearElVisibility();
        this._inputEl.focus();
    }

    private _onFocusOut(e: Event) {
        const event = e as FocusEvent;

        // Focus moves within the component (e.g., to clear button) → don't reset
        if (this.contains(event.relatedTarget as Node | null)) return;

        // Always close the dropdown when leaving the component
        this.open = false;

        // Reset input if no value was selected
        if (this.value === undefined) {
            this._abortController?.abort('ZAutocomplete : focus left without selection');
            this._inputEl.value = '';
            this._updateClearElVisibility();
        }
    }

    private _updateClearElVisibility() {
        if (this._clearEl) this._clearEl.hidden = !(this.value || this._inputEl.value);
    }

    private _onKeydown(e: Event) {
        const event = e as KeyboardEvent;

        if (!this.options.length || !this.open) return;

        switch (event.key) {
            case 'ArrowDown':
                this._navigateToOption(this._activeOptionIndex + 1);
                event.preventDefault();
                break;
            case 'ArrowUp':
                this._navigateToOption(this._activeOptionIndex - 1);
                event.preventDefault();
                break;
            case 'Enter':
                this._selectOption(this.options[this._activeOptionIndex]);
                event.preventDefault();
                break;
            case 'Escape':
                this.open = false;
                event.preventDefault();
                break;
            default:
                break;
        }
    }

    private _onInput(e: Event) {
        e.stopPropagation();
        this.options = [];

        if (!this._inputEl.value) return this._onClear();

        // reset value but keep input text intact for the user to continue typing
        if (this._value !== undefined) {
            this._value = undefined;
            this._dispatchAutocompleteEvent(undefined);
        }

        this._abortController?.abort('ZAutocomplete : A new search has been performed');
        this._abortController = new AbortController();

        this._onInputChange();
        this._updateClearElVisibility();
    }

    private async _onInputChange() {
        const data = await this.fetchData(this._inputEl.value, this._abortController?.signal);
        this.options = data.map(this.dataToOption.bind(this)) as ZAutocompleteOption<OptionValue>[];
    }

    private _selectOption(option?: ZAutocompleteOption<OptionValue>) {
        if (!option || option.disabled) return;

        this.value = option.value;
    }

    private _navigateToOption(newIndex: number) {
        if (newIndex < 0) return;
        if (newIndex === this._activeOptionIndex) return;
        if (newIndex > this.options.length - 1) return;

        // if the option chosen is disabled, we pass
        if (this.options[newIndex].disabled) {
            // allow scrolling on disabled li
            this._optionsEl.querySelector(`li[data-index="${newIndex}"]`)?.scrollIntoView({ block: 'nearest' });
            // compute next index
            let offset = newIndex - this._activeOptionIndex;
            offset = offset > 0 ? offset + 1 : offset - 1;
            this._navigateToOption(this._activeOptionIndex + offset);
            return;
        }

        this._activeOptionIndex = newIndex;

        // No rerender needed:
        const optionEls = [...this._optionsEl.querySelectorAll('li')]

        optionEls.forEach((el) => {
            const isSelected = el.dataset.index === String(newIndex);
            if (isSelected) el.scrollIntoView({ block: 'nearest' }); // needed if the ul is scrollable
        })
    }

    // --- publicly available
    public clear(): void {
        this._onClear();
    }

    // --- to be implemented from the outside
    public async fetchData(inputValue: string, abortSignal?: AbortSignal): Promise<OptionValue[]> {
        console.warn('ZAutocomplete : YOU MUST IMPLEMENT THE fetchData METHOD!', { inputValue, aborted: abortSignal?.aborted });
        return [];
    }

    public dataToOption(data?: OptionValue): ZAutocompleteOption<OptionValue> | undefined {
        if (typeof data === 'undefined') return undefined;

        return {
            label: String(data),
            value: data,
        };
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'z-autocomplete': ZAutocomplete<any>,
    }
}
