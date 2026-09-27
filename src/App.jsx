import React, { useState } from 'react';
import { BookCanvas, pages } from './components/Book2';
import './css/App.css';

function App() {
  const [page, setPage] = useState(0);

  const totalPages = pages.length;

  const handlePrev = () => setPage((p) => Math.max(0, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="viewer-container">
      {/* Header bar */}
      <header className="viewer-header">
        <div className="viewer-brand">
          <img
            src="/images/prisma_KGEC_CSE.png"
            alt="Prisma Logo"
            className="viewer-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="viewer-title">Interactive 3D Magazine</span>
        </div>
        <div className="viewer-hint">
          Click pages to turn • Drag to rotate in 3D
        </div>
      </header>

      {/* 3D Book Canvas (Self-contained) */}
      <BookCanvas
        page={page}
        onPageChange={setPage}
        pages={pages}
        texturePath="/textures/"
      />

      {/* Bottom Navigation Toolbar */}
      <footer className="viewer-footer">
        <div className="controls-bar">
          <button
            className="nav-btn"
            onClick={handlePrev}
            disabled={page === 0}
            title="Previous Page"
            aria-label="Previous Page"
          >
            ←
          </button>

          <div className="pages-scroll">
            <button
              className={`page-chip ${page === 0 ? 'active' : ''}`}
              onClick={() => setPage(0)}
            >
              Cover
            </button>
            {pages.slice(1, -1).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  className={`page-chip ${page === pageNum ? 'active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  Page {pageNum}
                </button>
              );
            })}
            <button
              className={`page-chip ${page === totalPages ? 'active' : ''}`}
              onClick={() => setPage(totalPages)}
            >
              Back Cover
            </button>
          </div>

          <button
            className="nav-btn"
            onClick={handleNext}
            disabled={page === totalPages}
            title="Next Page"
            aria-label="Next Page"
          >
            →
          </button>
        </div>

        <div className="page-status">
          {page === 0
            ? 'Front Cover'
            : page === totalPages
            ? 'Back Cover'
            : `Page ${page} of ${totalPages}`}
        </div>
      </footer>
    </div>
  );
}

export default App;
