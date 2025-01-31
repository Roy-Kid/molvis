import esbuild from 'esbuild';

const args = process.argv;

const config = {
  logLevel: 'info',
  entryPoints: ['src/index.ts'],
  outdir: 'src/molvis/build',
  bundle: true,
  format: "esm"
};

const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '127.0.0.1';

if (args.includes('--watch')) {
  esbuild
    .context({
      ...config,
      minify: false,
      sourcemap: "inline",
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