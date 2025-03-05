import * as esbuild from 'esbuild';

// Production build configuration
async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      minify: true,
      format: 'esm',
      target: ['es2020'],
      outdir: 'dist',
      sourcemap: false,
      metafile: true,
      loader: {
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.svg': 'dataurl',
        '.gif': 'dataurl',
      }
    });

    // Output build size information
    const { outputs } = result.metafile;
    let totalSize = 0;
    
    for (const [file, data] of Object.entries(outputs)) {
      console.log(`${file}: ${(data.bytes / 1024).toFixed(2)}kb`);
      totalSize += data.bytes;
    }
    
    console.log(`\nTotal size: ${(totalSize / 1024).toFixed(2)}kb`);
    console.log('Build completed successfully!');
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
