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
const AUTOCOMPLETE_OPTIONS = [
    { id: 1, libelle: 'Option1' },
    { id: 2, libelle: 'Option2' },
    { id: 3, libelle: 'Option3' },
    { id: 4, libelle: 'Option4' },
    { id: 5, libelle: 'Option5' },
    { id: 6, libelle: 'Option6' },
    { id: 7, libelle: 'Option7' },
    { id: 8, libelle: 'Option8' },
    { id: 9, libelle: 'Option9' },
    { id: 10, libelle: 'Option10' },
];

const fullExampleEl = document.querySelector('#full-example-el') as ZAutocomplete;

fullExampleEl.fetchOptions = async (inputValue: string, abortSignal) => {
    console.log('🔎 we are looking for ... ', inputValue);

    // it is here that you will put your fetch code!
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (abortSignal?.aborted) {
        console.error(abortSignal.reason);
        return [];
    }

    return AUTOCOMPLETE_OPTIONS;
}

fullExampleEl.formatOptionLibelle = (option) => {
    return option
        ? `#${option.id} ${ option.libelle ?? ''}`
        : '';
}

fullExampleEl.formatInputValueLibelle = (option) => {
    return String(option?.libelle || '');
}

fullExampleEl.addEventListener('autocomplete', (e: Event) => {
    const event = e as CustomEvent;

    console.log('🌟 value changed to', event.detail);
})

// default value if necessary
// fullExampleEl.value = AUTOCOMPLETE_OPTIONS[0];
