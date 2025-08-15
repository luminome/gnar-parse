// build.mjs - Updated for ESM output
import esbuild from 'esbuild';
import { exec } from 'child_process';

const isWatchMode = process.argv.includes('--watch');
const outFile = 'dev-products/wp-json-to-sac-item-type.js';

const runOnEndPlugin = {
  name: 'run-on-end',
  setup(build) {
    let childProcess;

    build.onEnd(result => {
      if (childProcess) {
        childProcess.kill();
      }

      if (result.errors.length > 0) {
        console.log('❌ Build failed, not running script.');
        return;
      }

      console.log('build-and-run');

      childProcess = exec(`node ${outFile}`, (err, stdout, stderr) => {
        if (err) {
          console.error(`❌ Script execution error:\n`, err);
          return;
        }
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      });
    });
  },
};

const buildOptions = {
  entryPoints: ['superlative/wp-json-to-sac-item-type.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: outFile,
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  loader: { '.svg': 'text' },
  plugins: isWatchMode ? [runOnEndPlugin] : [],
};

async function runBuild() {
  try {
    if (isWatchMode) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('✅ esbuild is now watching for deltas...in', buildOptions.entryPoints);
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Client build successful.');
    }
  } catch (err) {
    console.error('❌ Build script failed:', err);
    process.exit(1);
  }
}

runBuild();


// // build.mjs - The Corrected Watch Mode Version
// import esbuild from 'esbuild';

// // Check for a '--watch' command line argument
// const isWatchMode = process.argv.includes('--watch');

// console.log(`Starting client build (Watch Mode: ${isWatchMode})...`);

// // Define the common build options in an object
// const buildOptions = {
//   entryPoints: [
//     'superlative/wp-json-to-sac-item-type.ts'
//   ],
//   bundle: true,
//   platform: 'node',
//   format: 'esm',
//   outdir: 'dev-products',
//   sourcemap: true,
//   tsconfig: 'tsconfig.json',
//   loader: {
//     '.svg': 'text',
//   }
// };

// async function runBuild() {
//   try {
//     if (isWatchMode) {
//       // THIS IS THE FIX: Use esbuild.context() for watching
//       const ctx = await esbuild.context(buildOptions);
//       await ctx.watch();
//       console.log('🟩 esbuild is now watching for changes...');
//     } else {
//       // For a single build, use the regular esbuild.build()
//       await esbuild.build(buildOptions);
//       console.log('🟩 Client build successful.');
//     }
//   } catch (err) {
//     console.error('❌ Client build failed:', err);
//     process.exit(1);
//   }
// }

// // Run the build process
// runBuild();