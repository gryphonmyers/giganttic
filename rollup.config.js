import { terser } from "rollup-plugin-terser";
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    plugins: [nodeResolve()],
    input: './lib/giganttic-browser.js',
    output: {
      file: 'dist/giganttic-browser.cjs.js',
      format: 'cjs'
    }
  }, 
  {
    plugins: [nodeResolve()],
    input: './lib/giganttic-browser.js',
    output: {
      file: 'dist/giganttic-browser.cjs.min.js',
      plugins: [terser()],
      format: 'cjs'
    }
  }, 
  {
    plugins: [nodeResolve()],
    input: './lib/giganttic-browser.js',
    output: {
      file: 'dist/giganttic-browser.esm.js',
      format: 'esm'
    }
  }, 
  {
    plugins: [nodeResolve()],
    input: './lib/giganttic-browser.js',
    output: {
      file: 'dist/giganttic-browser.esm.min.js',
      plugins: [terser()],
      format: 'esm'
    }
  }
];