# Standalone 3D Book / Magazine Component (`Book2.jsx`)

This component enables an interactive, realistic 3D flipping book / magazine in React Three Fiber. It can be dropped into any React / Vite / Next.js project with zero external UI dependencies.

---

## 📦 Required Dependencies

In any project where you want to use `Book2.jsx`, install:

```bash
npm install three @types/three @react-three/fiber @react-three/drei maath jotai
```

---

## 📁 Required Assets

Ensure your `public/` directory contains:

- `public/textures/`:
  - Front and back cover textures (e.g. `book-cover.jpg`, `book-back.jpg`)
  - Page textures (e.g. `prisma_content_page-0001.jpg`, etc.)
  - Cover roughness map: `cover-roughness.png`
- `public/images/` (optional brand logos)

---

## 🚀 How to Use in Any Project

### Option 1: Drop-in Complete Viewer (`BookCanvas`)

The fastest way to render the book with complete 3D lighting, OrbitControls, and camera setup:

```jsx
import { BookCanvas } from "./components/Book2";

export default function MyPage() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <BookCanvas />
    </div>
  );
}
```

### Option 2: Controlled Page State with Custom Navigation

```jsx
import React, { useState } from "react";
import { BookCanvas, pages } from "./components/Book2";

export default function MagazineViewer() {
  const [page, setPage] = useState(0);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* 3D Book */}
      <BookCanvas
        page={page}
        onPageChange={setPage}
        pages={pages}
      />

      {/* Custom buttons */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
        <span> Page {page} / {pages.length} </span>
        <button onClick={() => setPage((p) => Math.min(pages.length, p + 1))}>Next</button>
      </div>
    </div>
  );
}
```

### Option 3: Using `<Book />` inside an existing `<Canvas>`

If your project already has a `<Canvas>`:

```jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Book } from "./components/Book2";

export default function CustomScene() {
  return (
    <Canvas camera={{ position: [0, 0.05, 3.1], fov: 42 }}>
      <Book />
      <OrbitControls />
      <Environment preset="studio" />
      <ambientLight intensity={0.7} />
      <directionalLight position={[0, 4, 3.5]} intensity={0.65} />
    </Canvas>
  );
}
```

### Option 4: Custom Pages / Custom Images

You can supply your own list of pictures using `createPagesFromPictures`:

```jsx
import { BookCanvas, createPagesFromPictures } from "./components/Book2";

const myPages = createPagesFromPictures(
  ["page1", "page2", "page3", "page4"], // image basenames or URLs
  "my-cover",                            // front cover
  "my-back"                              // back cover
);

export default function CustomBook() {
  return <BookCanvas pages={myPages} texturePath="/textures/" />;
}
```

---

## ⚙️ Component Props

### `<BookCanvas />`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pages` | `Array` | `defaultPages` | Array of `{ front, back }` page definitions |
| `page` | `number` | `undefined` | Controlled active page index (0 = front cover) |
| `onPageChange` | `(newPage) => void` | `undefined` | Callback fired when user flips pages |
| `texturePath` | `string` | `"/textures/"` | Base path for loading texture files |
| `orbitControls` | `boolean` | `true` | Enables/disables mouse rotate and pan |
| `camera` | `object` | `{ position: [0, 0.05, 3.1], fov: 42 }` | Three.js perspective camera options |

### `<Book />`
Can be rendered inside any `@react-three/fiber` `<Canvas>`.
Accepts `pages`, `page`, `onPageChange`, `pageAtom`, and `texturePath`.
