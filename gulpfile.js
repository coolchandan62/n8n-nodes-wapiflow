const { src, dest, task } = require('gulp');

// Copies every icon under nodes/ and credentials/ into the matching dist/
// path so n8n can serve the icons at runtime. Run via `gulp build:icons`
// (also wired into the `npm run build` script).
task('build:icons', () =>
    src(['credentials/**/*.{svg,png}', 'nodes/**/*.{svg,png}'], { base: '.' }).pipe(
        dest('dist/'),
    ),
);
