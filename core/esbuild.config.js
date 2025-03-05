import esbuild from 'esbuild';

const args = process.argv;
const devMode = args.includes('--dev');
const prodMode = args.includes('--prod');
const testMode = args.includes('--test');
const startMode = args.includes('--start');

const baseConfig = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/bundle.js',
  bundle: true,
};

if (devMode) {
  esbuild
    .build({
      ...baseConfig,
      outfile: 'dist/bundle.dev.js',
      sourcemap: true,
      watch: true,
      minify: false,
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

if (prodMode) {
  esbuild
    .build({
      ...baseConfig,
      outfile: 'dist/bundle.prod.js',
      minify: true,
      sourcemap: false,
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

if (testMode) {
  esbuild
    .build({
      ...baseConfig,
      entryPoints: ['tests/index.test.ts'],
      outfile: 'dist/bundle.test.js',
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

if (startMode) {
  esbuild
    .context({
      ...baseConfig,
      sourcemap: true,
      minify: false,
      watch: true,
    })
    .then(async (ctx) => {
      await ctx.watch();
      await ctx.serve({
        servedir: '.',
      });
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
