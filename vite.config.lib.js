import { defineConfig } from 'vite';
import dtsPlugin from 'vite-plugin-dts';

const WebComponentFile = 'src/z-autocomplete.ts';

export default defineConfig({
    plugins: [
        dtsPlugin({
            insertTypesEntry: true,
            include:  [WebComponentFile],
            rollupTypes: true,
        }),
    ],
    build: {
        outDir: 'dist',
        lib: {
            entry: WebComponentFile,
            formats: ['es'],
        },
    },
});
