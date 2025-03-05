import esbuild from 'esbuild';

const args = process.argv;
const devMode = args.includes('--dev');
const prodMode = args.includes('--prod');
const testMode = args.includes('--test');

const baseConfig = {
  entryPoints: ['src/index.tsx'],
  bundle: true,
  logLevel: 'info',
};

if (devMode) {
  esbuild
    .context({
      ...baseConfig,
      outfile: 'dist/bundle.dev.js',
      sourcemap: true,
      minify: false,
    }).then(async (ctx) => {
      await ctx.watch();
      await ctx.serve({
        servedir: '.',
        onRequest: ({ remoteAddress, method, path, status, timeInMS }) => {
          console.info(remoteAddress, status, `"${method} ${path}" [${timeInMS}ms]`);
        },
      });
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