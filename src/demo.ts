import './z-autocomplete.ts'
import type { ZAutocomplete } from './z-autocomplete.ts';

type OptionItem = {
    id: number,
    name: string
};

const AUTOCOMPLETE_DATA: OptionItem[] = [
    { id: 1, name: 'Option1' },
    { id: 2, name: 'Option2' },
    { id: 3, name: 'Option3' },
    { id: 4, name: 'Option4' },
    { id: 5, name: 'Option5 (preventDefault)' },
    { id: 6, name: 'Option6' },
    { id: 7, name: 'Option7' },
    { id: 8, name: 'Option8' },
    { id: 9, name: 'Option9' },
    { id: 10, name: 'Option10' },
    { id: 11, name: 'Option11' },
    { id: 12, name: 'Option12' },
];

const fullExampleEl = document.querySelector('#full-example-el') as ZAutocomplete<OptionItem>;
const fullExampleClear = document.querySelector('#full-example-clear') as HTMLButtonElement;

fullExampleEl.fetchData = async (inputValue, abortSignal) => {
    console.log('🔎 we are looking for ... ', inputValue);

    // it is here that you will put your fetch code!
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (abortSignal?.aborted) {
        console.error(abortSignal.reason);
        return [];
    }

    return AUTOCOMPLETE_DATA;
}

fullExampleEl.dataToOption = (data) => {
    if (!data) return undefined;

    // this is fake ...
    const isTitle = [1, 4, 7].includes(data.id);

    let label: string | HTMLElement = String(data.name);

    if (isTitle) {
        label = document.createElement('strong');
        label.textContent = data.name;
    }

    return {
        label,
        inputValue: String(data.name),
        value: data,
        disabled: isTitle,
    };
}

fullExampleEl.addEventListener('autocomplete', (e: Event) => {
    const event = e as CustomEvent<OptionItem | undefined>;

    if (event.detail?.id === 5) event.preventDefault();

    console.log('🌟 Chose value', event.detail, 'with event prevented', event.defaultPrevented);
})

// default value if necessary
// fullExampleEl.value = AUTOCOMPLETE_DATA[0];

fullExampleClear.addEventListener('click', () => {
    fullExampleEl.clear();
})
