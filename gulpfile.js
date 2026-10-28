const { src, dest, task } = require('gulp');

// Copies every icon under nodes/ and credentials/ into the matching dist/
// path so n8n can serve the icons at runtime. Run via `gulp build:icons`
// (also wired into the `npm run build` script).
//
// Gulp 5 defaults streams to UTF-8, which corrupts PNG bytes and shows a
// broken image in the n8n palette. encoding: false keeps icons binary.
task('build:icons', () =>
    src(['credentials/**/*.{svg,png}', 'nodes/**/*.{svg,png}'], {
        base: '.',
        encoding: false,
    }).pipe(dest('dist/')),
);
