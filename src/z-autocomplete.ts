import { LitElement, render } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { html } from 'lit/static-html.js';

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
    // no shadow root!
    createRenderRoot() {
        return this;
    }

    @property({ type: Number })
    public debouceDelay: Number = 300;

    // --- dom refs
    @query('[data-z-autocomplete-input]')
    private _inputEl!: HTMLInputElement | HTMLTextAreaElement; // | ElementContentEditable;

    @query('[data-z-autocomplete-clear]')
    private _clearEl!: HTMLElement;

    @query('[data-z-autocomplete-options]')
    private _optionsEl!: HTMLUListElement;

    // --- properties & state
    private _abortController?: AbortController;

    @state()
    private _activeOptionIndex: number = -1;

    // options visibility
    @property({ type: Boolean })
    set open(val: boolean) {
        const hidden = !val || !this.options.length;
        if (hidden) {
            this._activeOptionIndex = -1;
            this._optionsEl.scrollTo(0, 0);
        }
        this._optionsEl.hidden = hidden;
        this._inputEl.setAttribute('aria-expanded', String(!this._optionsEl.hidden));
    }
    get open() {
        return !this._optionsEl.hidden;
    }

    // value
    private _value ?: OptionValue;
    @property({ attribute: false })
    set value(val: OptionValue | undefined) {
        const autocompleteEvt = new CustomEvent('autocomplete', {
            detail: val,
            bubbles: true,
            // composed: true, // no need because no shadowDom is used ?
            cancelable: true,
        });

        this.dispatchEvent(autocompleteEvt);

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
    }
    get value() {
        return this._value;
    };

    // options
    private _options: ZAutocompleteOption<OptionValue>[] = [];
    @property({ type: Array })
    set options(val: ZAutocompleteOption<OptionValue>[]) {
        this._options = val.filter(Boolean);
        this._renderOptions();
        this.open = !!val.length;
    }
    get options() {
        return this._options;
    }

    connectedCallback(): void {
        super.connectedCallback();

        // override methode for a debounced one.
        this._onInputChange = debounce(this._onInputChange.bind(this), this.debouceDelay);

        this._initInputEl();
        this._initOptionsEl();

        this._inputEl.addEventListener('input', this._onInput.bind(this));

        if (this._clearEl) {
            this._initClearEl();
            this._clearEl.addEventListener('click', this._onClear.bind(this));
        }

        document.addEventListener('click', this._handleClickOutside.bind(this));
        this._inputEl.addEventListener('keydown', this._onKeydown.bind(this));
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._abortController?.abort('ZAutocomplete is beeing destroyed');

        this._inputEl.removeEventListener('input', this._onInput.bind(this));
        if (this._clearEl) this._clearEl.removeEventListener('click', this._onClear.bind(this))
        document.removeEventListener('click', this._handleClickOutside.bind(this));
        this._inputEl.removeEventListener('keydown', this._onKeydown.bind(this));

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

    private _initOptionsEl(): void {
        if(!this._optionsEl) throw new Error('ZAutocomplete : No ul[data-z-autocomplete-options] element provided to take control on');

        this._optionsEl.setAttribute('role', 'listbox');
        this._optionsEl.hidden = true;
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

    private _renderOptions() {
        let template;

        if (this.options.length) template = this.options.map(this._formatOptionTemplate.bind(this));

        render(template || '', this._optionsEl);
    }

    private _formatOptionTemplate(option: ZAutocompleteOption<OptionValue>, index: number) {
        return html`
            <li @click="${() => this._selectOption(option)}"
                data-index="${index}"
                aria-selected="${index === this._activeOptionIndex}"
                aria-disabled="${!!option.disabled}">
                ${option.label}
            </li>
        `
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

            el.setAttribute('aria-selected', String(isSelected));

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
