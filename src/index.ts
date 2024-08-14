import './z-autocomplete.ts'
import type { ZAutocomplete } from './z-autocomplete.ts';

// Add navigation in demo page.
const navItems = document.querySelectorAll('section h2');
const nav = document.createElement('nav');
nav.innerHTML = /* html */`
    <div class="nav-burger">
        <svg viewBox="0 0 120 80" version="1.0" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <rect x="15" width="90" height="15" rx="10"></rect>
            <rect x="15" y="30" width="90" height="15" rx="10"></rect>
            <rect x="15" y="60" width="90" height="15" rx="10"></rect>
        </svg>
    </div>
`;

[...navItems].forEach((el) => {
    const navLink = document.createElement('a');
    const headingLink = document.createElement('a');

    navLink.href=`#${el.id}`;
    navLink.textContent = el.textContent;

    headingLink.href=`#${el.id}`;
    headingLink.textContent = '# ';

    nav.append(navLink);
    el.prepend(headingLink);
})

document.body.querySelector('header')?.after(nav);

// Fetch method for the Full Demo
const AUTOCOMPLETE_DATA = [
    { id: 1, name: 'Option1' },
    { id: 2, name: 'Option2' },
    { id: 3, name: 'Option3' },
    { id: 4, name: 'Option4' },
    { id: 5, name: 'Option5' },
    { id: 6, name: 'Option6' },
    { id: 7, name: 'Option7' },
    { id: 8, name: 'Option8' },
    { id: 9, name: 'Option9' },
    { id: 10, name: 'Option10' },
    { id: 11, name: 'Option11' },
    { id: 12, name: 'Option12' },
];

const fullExampleEl = document.querySelector('#full-example-el') as ZAutocomplete;

fullExampleEl.fetchData = async (inputValue: string, abortSignal) => {
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
    const event = e as CustomEvent;

    console.log('🌟 value changed to', event.detail);
})

// default value if necessary
// fullExampleEl.value = AUTOCOMPLETE_DATA[0];
