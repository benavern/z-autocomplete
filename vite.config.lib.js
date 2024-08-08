import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        lib: {
            entry: 'src/z-autocomplete.ts',
            formats: ['es'],
        },
    },
});
