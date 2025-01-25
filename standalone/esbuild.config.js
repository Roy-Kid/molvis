import esbuild from 'esbuild';

const args = process.argv;

const config = {
  logLevel: 'info',
  entryPoints: ['src/index.tsx'],
  outfile: 'build/bundle.js',
  bundle: true
};

const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '127.0.0.1';

if (args.includes('--build')) {
  esbuild
    .build({
      ...config,
      minify: true,
      sourcemap: false,
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

if (args.includes('--start')) {
  esbuild
    .context({
      ...config,
      minify: false,
      sourcemap: true,
      loader: { '.tsx': 'tsx' } // 添加加载tsx文件的配置
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