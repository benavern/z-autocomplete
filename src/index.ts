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
