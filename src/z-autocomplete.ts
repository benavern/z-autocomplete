import { LitElement, render } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { html } from 'lit/static-html.js';

const debounce: Function = (cb: Function, delay: number = 1000) => {
    let timer: number;

    return (...args: any[]) => {
        clearTimeout(timer);

        timer = setTimeout(() => {
            cb(...args);
        }, delay);
    };
};

const clamp = (nb: Number, { min = -Infinity, max = Infinity }) => {
    return Math.max(min, Math.min(Number(nb) || min, max));
}

@customElement('z-autocomplete')
export class ZAutocomplete extends LitElement {
    // no shadow root!
    createRenderRoot() {
        return this;
    }

    // --- dom refs
    @query('input')
    private _inputEl!: HTMLInputElement;

    @query('button')
    private _clearEl!: HTMLButtonElement;

    @query('ul')
    private _optionsEl!: HTMLUListElement;

    // --- properties & state
    private _abortController?: AbortController;

    @state()
    private _activeOptionIndex?: number;

    // options visibility
    @property({ type: Boolean })
    set open(val: boolean) {
        this._optionsEl.hidden = !val || !this.options.length;
    }
    get open() {
        return !this._optionsEl.hidden;
    }

    // value
    private _value ?: any;
    @property()
    set value(val: any) {
        this._value = val;
        this._clearOptions();
        this._inputEl.value = this.formatInputValueLibelle(val);
        this.dispatchEvent(new CustomEvent('change', {
            detail: val,
            bubbles: true,
            composed: true,
        }));
    }
    get value() {
        return this._value
    };

    // options
    private _options: any[] = [];
    @property({ type: Array })
    set options(val: any[]) {
        this._options = val;
        this._renderOptions();
        this._optionsEl.hidden = !this.options.length;
    }
    get options() {
        return this._options;
    }

    // --- init
    constructor() {
        super();

        this._onInputChange = debounce(this._onInputChange.bind(this), 300);
    }

    connectedCallback(): void {
        super.connectedCallback();

        if(!this._inputEl) throw new Error('No <input> element provided to take control on');
        if(!this._optionsEl) throw new Error('No <ul> element provided to take control on');

        document.addEventListener('click', this._handleClickOutside.bind(this));
        if (this._clearEl) this._clearEl.addEventListener('click', this._onClear.bind(this))
        this./*_inputEl.*/addEventListener('keydown', this._onKeydown.bind(this));
        this._inputEl.addEventListener('input', this._onInput.bind(this));
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();

        this._onClear();

        document.removeEventListener('click', this._handleClickOutside.bind(this));
        if (this._clearEl) this._clearEl.removeEventListener('click', this._onClear.bind(this))
        this./*_inputEl.*/removeEventListener('keydown', this._onKeydown.bind(this));
        this._inputEl.removeEventListener('input', this._onInput.bind(this));
    }

    // --- private methods
    private _onClear() {
        this._abortController?.abort('the input has been cleared.');
        this._inputEl.value = '';
        this.value = undefined;

        this._clearOptions();
    }

    private _clearOptions() {
        this.options = [];
        this.open = false;
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
                this._navigateToNextOption();
                event.preventDefault();
                break;
            case 'ArrowUp':
                this._navigateToNextOption(-1);
                event.preventDefault();
                break;
            case 'Enter':
                    this._selectOption(this.options[this._activeOptionIndex ?? -1]);
                    event.preventDefault();
                break;
        }
    }

    private _onInput(e: Event) {
        e.stopPropagation();
        this._clearOptions();
        if (!this._inputEl.value) return this._onClear();

        this._abortController?.abort('A new search has been performed');
        this._abortController = new AbortController();

        this._onInputChange();
    }

    private async _onInputChange() {
        this.options = await this.fetchOptions(this._inputEl.value, this._abortController?.signal);
    }

    private _renderOptions() {
        let template;

        if (this.options.length) template = map(this.options, this._formatOption.bind(this));

        render(template || '', this._optionsEl);
    }

    private _formatOption(option:any, index?: number) {
        return html`
            <li @click="${() => this._selectOption(option)}"
                aria-selected="${index === this._activeOptionIndex}">
                ${this.formatOptionLibelle(option)}
            </li>
        `
    }

    private _selectOption(option:any) {
        this.value = option;
    }

    private _navigateToNextOption(offset:number = 1) {
        let newIndex: number | undefined = Number(this._activeOptionIndex ?? -1);
        newIndex += offset;
        newIndex = clamp(newIndex, { min: 0, max: this.options.length - 1 });
        if (newIndex === this._activeOptionIndex) newIndex = undefined;

        this._activeOptionIndex = newIndex;
        this._renderOptions();
    }

    // --- to be implemented from the exterior
    public async fetchOptions(inputValue: string, abortSignal?: AbortSignal): Promise<any[]> {
        console.warn('YOU MUST IMPLEMENT THE fetchOptions METHOD!', { inputValue, aborted: abortSignal?.aborted });
        return [];
    }

    public formatOptionLibelle(option: any): string {
        return String(option || '');
    }

    public formatInputValueLibelle(option: any): string {
        return this.formatOptionLibelle(option);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'z-autocomplete': ZAutocomplete,
    }
}
