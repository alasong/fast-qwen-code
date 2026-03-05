// vite.config.ts
import { defineConfig } from "file:///home/song/qwen-code/packages/webui/node_modules/vite/dist/node/index.js";
import react from "file:///home/song/qwen-code/node_modules/@vitejs/plugin-react/dist/index.js";
import dts from "file:///home/song/qwen-code/packages/webui/node_modules/vite-plugin-dts/dist/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/home/song/qwen-code/packages/webui";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src"],
      outDir: "dist",
      rollupTypes: true,
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
      name: "QwenCodeWebUI",
      formats: ["es", "cjs", "umd"],
      fileName: (format) => {
        if (format === "es") return "index.js";
        if (format === "cjs") return "index.cjs";
        if (format === "umd") return "index.umd.js";
        return "index.js";
      }
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime"
        },
        assetFileNames: "styles.[ext]"
      }
    },
    sourcemap: true,
    minify: false,
    cssCodeSplit: false
  }
});
export {
  vite_config_default as default
};
/**
* @license
* Copyright 2025 Qwen Team
* SPDX-License-Identifier: Apache-2.0
*/
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9zb25nL3F3ZW4tY29kZS9wYWNrYWdlcy93ZWJ1aVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvc29uZy9xd2VuLWNvZGUvcGFja2FnZXMvd2VidWkvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvc29uZy9xd2VuLWNvZGUvcGFja2FnZXMvd2VidWkvdml0ZS5jb25maWcudHNcIjsvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgMjAyNSBRd2VuIFRlYW1cbiAqIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBBcGFjaGUtMi4wXG4gKi9cblxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IGR0cyBmcm9tICd2aXRlLXBsdWdpbi1kdHMnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIFZpdGUgY29uZmlndXJhdGlvbiBmb3IgQHF3ZW4tY29kZS93ZWJ1aSBsaWJyYXJ5XG4gKlxuICogQnVpbGQgb3V0cHV0czpcbiAqIC0gRVNNOiBkaXN0L2luZGV4LmpzIChwcmltYXJ5IGZvcm1hdClcbiAqIC0gQ0pTOiBkaXN0L2luZGV4LmNqcyAoY29tcGF0aWJpbGl0eSlcbiAqIC0gVU1EOiBkaXN0L2luZGV4LnVtZC5qcyAoZm9yIENETiB1c2FnZSlcbiAqIC0gVHlwZVNjcmlwdCBkZWNsYXJhdGlvbnM6IGRpc3QvaW5kZXguZC50c1xuICogLSBDU1M6IGRpc3Qvc3R5bGVzLmNzcyAob3B0aW9uYWwgc3R5bGVzKVxuICovXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBkdHMoe1xuICAgICAgaW5jbHVkZTogWydzcmMnXSxcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxuICAgICAgcm9sbHVwVHlwZXM6IHRydWUsXG4gICAgICBpbnNlcnRUeXBlc0VudHJ5OiB0cnVlLFxuICAgIH0pLFxuICBdLFxuICBidWlsZDoge1xuICAgIGxpYjoge1xuICAgICAgZW50cnk6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2luZGV4LnRzJyksXG4gICAgICBuYW1lOiAnUXdlbkNvZGVXZWJVSScsXG4gICAgICBmb3JtYXRzOiBbJ2VzJywgJ2NqcycsICd1bWQnXSxcbiAgICAgIGZpbGVOYW1lOiAoZm9ybWF0KSA9PiB7XG4gICAgICAgIGlmIChmb3JtYXQgPT09ICdlcycpIHJldHVybiAnaW5kZXguanMnO1xuICAgICAgICBpZiAoZm9ybWF0ID09PSAnY2pzJykgcmV0dXJuICdpbmRleC5janMnO1xuICAgICAgICBpZiAoZm9ybWF0ID09PSAndW1kJykgcmV0dXJuICdpbmRleC51bWQuanMnO1xuICAgICAgICByZXR1cm4gJ2luZGV4LmpzJztcbiAgICAgIH0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBleHRlcm5hbDogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3QvanN4LXJ1bnRpbWUnXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgcmVhY3Q6ICdSZWFjdCcsXG4gICAgICAgICAgJ3JlYWN0LWRvbSc6ICdSZWFjdERPTScsXG4gICAgICAgICAgJ3JlYWN0L2pzeC1ydW50aW1lJzogJ1JlYWN0SlNYUnVudGltZScsXG4gICAgICAgIH0sXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAnc3R5bGVzLltleHRdJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgbWluaWZ5OiBmYWxzZSxcbiAgICBjc3NDb2RlU3BsaXQ6IGZhbHNlLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBTUEsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sU0FBUztBQUNoQixTQUFTLGVBQWU7QUFUeEIsSUFBTSxtQ0FBbUM7QUFxQnpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLElBQUk7QUFBQSxNQUNGLFNBQVMsQ0FBQyxLQUFLO0FBQUEsTUFDZixRQUFRO0FBQUEsTUFDUixhQUFhO0FBQUEsTUFDYixrQkFBa0I7QUFBQSxJQUNwQixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsT0FBTyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxNQUN4QyxNQUFNO0FBQUEsTUFDTixTQUFTLENBQUMsTUFBTSxPQUFPLEtBQUs7QUFBQSxNQUM1QixVQUFVLENBQUMsV0FBVztBQUNwQixZQUFJLFdBQVcsS0FBTSxRQUFPO0FBQzVCLFlBQUksV0FBVyxNQUFPLFFBQU87QUFDN0IsWUFBSSxXQUFXLE1BQU8sUUFBTztBQUM3QixlQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFVBQVUsQ0FBQyxTQUFTLGFBQWEsbUJBQW1CO0FBQUEsTUFDcEQsUUFBUTtBQUFBLFFBQ04sU0FBUztBQUFBLFVBQ1AsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFVBQ2IscUJBQXFCO0FBQUEsUUFDdkI7QUFBQSxRQUNBLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBLElBQ0EsV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLElBQ1IsY0FBYztBQUFBLEVBQ2hCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
