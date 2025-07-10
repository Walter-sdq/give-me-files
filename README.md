# Vite + React + shadcn/ui + Tailwind CSS + TypeScript

This project is a modern web application starter template using:

- [Vite](https://vitejs.dev/) for fast development and build
- [React](https://react.dev/) for UI development
- [shadcn/ui](https://ui.shadcn.com/) for accessible, customizable UI components
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling
- [TypeScript](https://www.typescriptlang.org/) for static typing

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

Clone the repository and install dependencies:

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
```

### Development

Start the development server:

```sh
npm run dev
```

The app will be available at [http://localhost:8080](http://localhost:8080) by default.

### Building for Production

```sh
npm run build
```

### Preview Production Build

```sh
npm run preview
```

## Project Structure

- `src/` — Main source code
  - `components/` — Reusable React components
  - `hooks/` — Custom React hooks
  - `lib/` — Utility functions
  - `pages/` — Page components
  - `services/` — Service modules (e.g., API, WebRTC)
- `public/` — Static assets
- `index.html` — Main HTML file

## Customization
- Update the project name and description in `package.json` as needed.
- Modify or add components in `src/components/`.
- Configure Tailwind in `tailwind.config.ts` and `postcss.config.js`.

## License

This project is open source and available under the [MIT License](LICENSE).
