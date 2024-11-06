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

const debounce: Function = (cb: Function, delay: number = 1000) => {
    let timer: number;

    return (...args: any[]) => {
        clearTimeout(timer);

        timer = setTimeout(() => {
            cb(...args);
        }, delay);
    };
};

@customElement('z-autocomplete')
export class ZAutocomplete<OptionValue> extends LitElement {
    // local non reactive properties
    private _abortController?: AbortController;
    private _inputEl!: HTMLInputElement | HTMLTextAreaElement;
    private _clearEl!: HTMLElement;
    private _open: boolean = false;
    private _value ?: OptionValue;
    private _options: ZAutocompleteOption<OptionValue>[] = [];

    @property({ type: Number })
    public debouceDelay: Number = 300;

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
        const autocompleteEvt = new CustomEvent('autocomplete', {
            detail: val,
            bubbles: true,
            composed: true,
            cancelable: true,
        });

        this.dispatchEvent(autocompleteEvt);

        // only change value when component ready
        // or this._inputEl could be undefined (ex: on initialization, before connectedCallback is finished)
        this.updateComplete.then(() => {
            if (!autocompleteEvt.defaultPrevented) {
                this._value = val;

                // udpate input value first
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

        // override methode for a debounced one.
        this._onInputChange = debounce(this._onInputChange.bind(this), this.debouceDelay);

        this._inputEl.addEventListener('input', this._onInput.bind(this));
        this._inputEl.addEventListener('keydown', this._onKeydown.bind(this));

        if (this._clearEl) {
            this._initClearEl();
            this._clearEl.addEventListener('click', this._onClear.bind(this));
        }

        document.addEventListener('click', this._handleClickOutside.bind(this));
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._abortController?.abort('ZAutocomplete is beeing destroyed');

        this._inputEl.removeEventListener('input', this._onInput.bind(this));
        this._inputEl.removeEventListener('keydown', this._onKeydown.bind(this));

        if (this._clearEl) this._clearEl.removeEventListener('click', this._onClear.bind(this))

        document.removeEventListener('click', this._handleClickOutside.bind(this));

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
                role="listbox"
                @click=${() => this._selectOption(option)}>
                ${option.label}
            </li>
        `
    }

    // --- private methods
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
        this.value = undefined;
        this._inputEl.focus();
    }

    private _updateClearElVisibility() {
        if (this._clearEl) this._clearEl.hidden = !(this.value || this._inputEl.value);
    }

    private _handleClickOutside(e: Event) {
        const event = e as MouseEvent;

        this.open = this.contains(event.target as Node | null);
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
        console.warn('ZAutocomplete : YOU MUST IMPLEMENT THE fetchOptions METHOD!', { inputValue, aborted: abortSignal?.aborted });
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
