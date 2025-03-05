import esbuild from 'esbuild';

const args = process.argv;
const devMode = args.includes('--dev');
const prodMode = args.includes('--prod');
const testMode = args.includes('--test');
const startMode = args.includes('--start');

const baseConfig = {
  entryPoints: ['src/index.tsx'],
  outfile: 'build/bundle.js',
  bundle: true,
  logLevel: 'info',
};

if (devMode) {
  esbuild
    .build({
      ...baseConfig,
      outfile: 'build/bundle.dev.js',
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
      outfile: 'build/bundle.prod.js',
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
      outfile: 'build/bundle.test.js',
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
      loader: { '.tsx': 'tsx' },
      minify: false,
    })
    .then(async (ctx) => {
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