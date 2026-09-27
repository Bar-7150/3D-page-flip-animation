import { Environment, OrbitControls, useCursor, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { atom, useAtom } from "jotai";
import { easing } from "maath";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./css/Book2.css";
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from "three";

const { degToRad } = MathUtils;

// Default picture list
export const DEFAULT_PICTURES = [
  "prisma_content_page-0021",
  "prisma_content_page-0021",
  "prisma_content_page-0021",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
  "prisma_content_page-0020",
  "prisma_content_page-0021",
];

// Helper to create page pairs from any array of pictures
export function createPagesFromPictures(pictures, frontCover = "book-cover", backCover = "book-back") {
  if (!pictures || pictures.length === 0) {
    return [
      { front: frontCover, back: backCover },
    ];
  }
  const result = [
    {
      front: frontCover,
      back: pictures[0],
    },
  ];
  for (let i = 1; i < pictures.length - 1; i += 2) {
    result.push({
      front: pictures[i % pictures.length],
      back: pictures[(i + 1) % pictures.length],
    });
  }
  result.push({
    front: pictures[pictures.length - 1],
    back: backCover,
  });
  return result;
}

export const defaultPages = createPagesFromPictures(DEFAULT_PICTURES);
export const pages = defaultPages; // Alias for backward compatibility

// Global shared atom (optional; used when no external page state is provided)
export const pageAtom = atom(0);

// Helper to resolve texture paths
export const resolveTextureUrl = (name, texturePath = "/textures/") => {
  if (!name) return "";
  if (
    name.startsWith("/") ||
    name.startsWith("http://") ||
    name.startsWith("https://") ||
    name.startsWith("data:")
  ) {
    return name;
  }
  if (/\.(jpg|jpeg|png|webp|avif)$/i.test(name)) {
    return `${texturePath}${name}`;
  }
  return `${texturePath}${name}.jpg`;
};

// Texture preloader
export const preloadPages = (pagesToPreload = defaultPages, texturePath = "/textures/") => {
  try {
    pagesToPreload.forEach((page) => {
      useTexture.preload(resolveTextureUrl(page.front, texturePath));
      useTexture.preload(resolveTextureUrl(page.back, texturePath));
    });
    useTexture.preload(`${texturePath}cover-roughness.png`);
  } catch (err) {
    // Graceful fallback for SSR or environments without GL
  }
};

// Preload default pages
try {
  preloadPages(defaultPages);
} catch (e) { }

const easingFactor = 0.45;
const easingFactorFold = 0.3;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;
const mobileInsideCurveStrength = 0.18;
const mobileOutsideCurveStrength = 0.05;
const mobileTurningWaveStrength = 0.3;

const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71; // 4:3 aspect ratio
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

const pageGeometry = new BoxGeometry(
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  2
);

pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

const position = pageGeometry.attributes.position;
const vertex = new Vector3();
const skinIndexes = [];
const skinWeights = [];

for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  const x = vertex.x;

  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
  let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;

  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
}

pageGeometry.setAttribute(
  "skinIndex",
  new Uint16BufferAttribute(skinIndexes, 4)
);
pageGeometry.setAttribute(
  "skinWeight",
  new Float32BufferAttribute(skinWeights, 4)
);

const whiteColor = new Color("white");
const paperBlankColor = new Color("#fbfbfa");
const emissiveColor = new Color("orange");

const pageMaterials = [
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: "#111" }),
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }),
];

const Page = ({
  number,
  front,
  back,
  page,
  opened,
  bookClosed,
  totalPages,
  texturePath = "/textures/",
  onPageClick,
  ...props
}) => {
  const isBackCover = number === totalPages - 1;
  const isFrontCover = number === 0;

  const textureUrls = useMemo(() => {
    const urls = [
      resolveTextureUrl(front, texturePath),
      resolveTextureUrl(back, texturePath),
    ];
    if (isFrontCover || isBackCover) {
      urls.push(`${texturePath}cover-roughness.png`);
    }
    return urls;
  }, [front, back, texturePath, isFrontCover, isBackCover]);

  const textures = useTexture(textureUrls);
  const picture = textures[0];
  const picture2 = textures[1];
  const pictureRoughness = isFrontCover || isBackCover ? textures[2] : null;

  const gl = useThree((state) => state.gl);
  const maxAnisotropy = useMemo(
    () => (gl?.capabilities?.getMaxAnisotropy ? gl.capabilities.getMaxAnisotropy() : 16),
    [gl]
  );

  if (picture) {
    picture.colorSpace = SRGBColorSpace;
    picture.anisotropy = maxAnisotropy;
  }
  if (picture2) {
    picture2.colorSpace = SRGBColorSpace;
    picture2.anisotropy = maxAnisotropy;
  }

  useEffect(() => {
    [picture, picture2].forEach((tex) => {
      if (tex) {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = maxAnisotropy;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
      }
    });
  }, [picture, picture2, maxAnisotropy]);

  const group = useRef();
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);

  const size = useThree((state) => state.size);
  const isMobile =
    (typeof window !== "undefined" &&
      (window.innerWidth < 768 || window.innerHeight > window.innerWidth)) ||
    size.width < 768 ||
    size.width < size.height;

  const skinnedMeshRef = useRef();
  const turnProgress = useRef(opened ? 1 : 0);

  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      let bone = new Bone();
      bones.push(bone);
      if (i === 0) {
        bone.position.x = 0;
      } else {
        bone.position.x = SEGMENT_WIDTH;
      }
      if (i > 0) {
        bones[i - 1].add(bone);
      }
    }
    const skeleton = new Skeleton(bones);

    const materials = [
      ...pageMaterials,
      new MeshStandardMaterial({
        color: whiteColor,
        map: picture,
        ...(isFrontCover
          ? {
            roughnessMap: pictureRoughness,
            roughness: 0.35,
            metalness: 0.05,
            envMapIntensity: 0.4,
          }
          : {
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0.0,
          }),
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
      new MeshStandardMaterial({
        color: isMobile && !isBackCover ? paperBlankColor : whiteColor,
        map: isMobile && !isBackCover ? null : picture2,
        ...(isBackCover
          ? {
            roughnessMap: pictureRoughness,
            roughness: 0.35,
            metalness: 0.05,
            envMapIntensity: 0.4,
          }
          : {
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0.0,
          }),
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
    ];
    const mesh = new SkinnedMesh(pageGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [isMobile, isFrontCover, isBackCover, picture, picture2, pictureRoughness]);

  useEffect(() => {
    if (skinnedMeshRef.current && skinnedMeshRef.current.material) {
      const backMat = skinnedMeshRef.current.material[5];
      if (backMat) {
        if (isMobile && !isBackCover) {
          backMat.map = null;
          backMat.color = paperBlankColor;
          backMat.roughness = 1.0;
          backMat.metalness = 0.0;
          backMat.envMapIntensity = 0.0;
        } else {
          backMat.map = picture2;
          backMat.color = whiteColor;
          backMat.roughness = isBackCover ? 0.35 : 1.0;
          backMat.metalness = isBackCover ? 0.05 : 0.0;
          backMat.envMapIntensity = isBackCover ? 0.4 : 0.0;
        }
        backMat.needsUpdate = true;
      }
    }
  }, [isMobile, picture2, isBackCover]);

  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current || !group.current) {
      return;
    }

    const emissiveIntensity = highlighted ? 0.05 : 0;
    if (skinnedMeshRef.current.material[4]) {
      skinnedMeshRef.current.material[4].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[4].emissiveIntensity,
        emissiveIntensity,
        0.1
      );
    }
    if (skinnedMeshRef.current.material[5]) {
      skinnedMeshRef.current.material[5].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[5].emissiveIntensity,
        emissiveIntensity,
        0.1
      );
    }

    const bones = skinnedMeshRef.current.skeleton.bones;

    if (isMobile) {
      const targetProgress = opened ? 1 : 0;
      turnProgress.current = MathUtils.damp(
        turnProgress.current,
        targetProgress,
        10,
        delta
      );

      const p = turnProgress.current;

      group.current.visible = true;
      skinnedMeshRef.current.visible = true;

      const frontLayer = number - page;
      const backLayer = totalPages - 1 - number;

      const frontDepth = -frontLayer * PAGE_DEPTH;
      const backDepth = -backLayer * PAGE_DEPTH - 0.006;
      const currentBaseDepth = MathUtils.lerp(frontDepth, backDepth, p);

      const lift = Math.sin(p * Math.PI) * 0.3;
      group.current.position.x = currentBaseDepth + lift;
      group.current.position.y = 0;
      group.current.position.z = 0;
      skinnedMeshRef.current.position.set(0, 0, 0);

      group.current.rotation.y = -p * 2 * Math.PI;
      group.current.rotation.x = 0;
      group.current.rotation.z = 0;

      const frontTargetRotation = Math.PI / 2 + degToRad(frontLayer * 0.8);
      const backTargetRotation = Math.PI / 2 + degToRad(backLayer * 0.8);
      const pageTargetRotation = MathUtils.lerp(
        frontTargetRotation,
        backTargetRotation,
        p
      );

      const turningArc = Math.sin(p * Math.PI);

      for (let i = 0; i < bones.length; i++) {
        const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
        const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
        const restingCurveY =
          mobileInsideCurveStrength * insideCurveIntensity * pageTargetRotation -
          mobileOutsideCurveStrength * outsideCurveIntensity * pageTargetRotation;

        let boneY = restingCurveY;

        if (turningArc > 0.001) {
          const turnWave =
            ((Math.sin((i / bones.length) * Math.PI) * mobileTurningWaveStrength) /
              bones.length) *
            turningArc;
          boneY += -turnWave;
        }

        let boneX = 0;
        if (turningArc > 0.001 && i > 8) {
          const curlFraction = degToRad(5) / (bones.length - 8);
          boneX =
            curlFraction *
            Math.sin(((i - 8) / (bones.length - 8)) * Math.PI) *
            turningArc;
        }

        bones[i].rotation.y = boneY;
        bones[i].rotation.x = boneX;
        bones[i].rotation.z = 0;
      }
    } else {
      group.current.visible = true;
      skinnedMeshRef.current.visible = true;
      group.current.position.x = 0;
      let targetZ = -number * PAGE_DEPTH + page * PAGE_DEPTH;
      easing.damp(skinnedMeshRef.current.position, "z", targetZ, 0.35, delta);

      let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
      if (!bookClosed) {
        targetRotation += degToRad(number * 0.8);
      }

      if (lastOpened.current !== opened) {
        turnedAt.current = +new Date();
        lastOpened.current = opened;
      }
      const elapsed = new Date() - turnedAt.current;
      const turningProgress = Math.min(1, Math.max(0, elapsed / 450));
      const turningTime = Math.sin(turningProgress * Math.PI);

      for (let i = 0; i < bones.length; i++) {
        const target = i === 0 ? group.current : bones[i];

        const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.1) : 0;
        const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
        const turningIntensity =
          Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;
        let rotationAngle =
          insideCurveStrength * insideCurveIntensity * targetRotation -
          outsideCurveStrength * outsideCurveIntensity * targetRotation +
          turningCurveStrength * turningIntensity * targetRotation;
        let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);

        if (bookClosed) {
          if (i === 0) {
            rotationAngle = targetRotation;
            foldRotationAngle = 0;
          } else {
            rotationAngle = 0;
            foldRotationAngle = 0;
          }
        }

        easing.dampAngle(
          target.rotation,
          "y",
          rotationAngle,
          easingFactor,
          delta
        );

        const foldIntensity =
          i > 8
            ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime
            : 0;
        easing.dampAngle(
          target.rotation,
          "x",
          foldRotationAngle * foldIntensity,
          easingFactorFold,
          delta
        );
      }
    }
  });

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHighlighted(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHighlighted(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (onPageClick) {
          onPageClick(number, opened, e, isMobile);
        }
        setHighlighted(false);
      }}
    >
      <primitive object={manualSkinnedMesh} ref={skinnedMeshRef} />
    </group>
  );
};

export const Book = ({
  pages = defaultPages,
  page: propPage,
  onPageChange,
  pageAtom: customAtom,
  texturePath = "/textures/",
  ...props
}) => {
  // Support both Jotai atom and controlled props / internal state
  const [atomValue, setAtomValue] = useAtom(customAtom || pageAtom);

  const isControlled = propPage !== undefined;
  const activePage = isControlled ? propPage : atomValue;

  const setActivePage = (updater) => {
    if (isControlled) {
      const next = typeof updater === "function" ? updater(propPage) : updater;
      onPageChange?.(next);
    } else {
      setAtomValue(updater);
      if (onPageChange) {
        const next = typeof updater === "function" ? updater(atomValue) : updater;
        onPageChange(next);
      }
    }
  };

  const [delayedPage, setDelayedPage] = useState(activePage);
  const bookGroupRef = useRef();

  const { width: viewportWidth } = useThree((state) => state.viewport);
  const size = useThree((state) => state.size);
  const isMobile =
    (typeof window !== "undefined" &&
      (window.innerWidth < 768 || window.innerHeight > window.innerWidth)) ||
    size.width < 768 ||
    size.width < size.height;

  useEffect(() => {
    let timeout;
    const goToPage = () => {
      setDelayedPage((current) => {
        if (activePage === current) {
          return current;
        } else {
          timeout = setTimeout(
            () => {
              goToPage();
            },
            Math.abs(activePage - current) > 2 ? 50 : 150
          );
          if (activePage > current) {
            return current + 1;
          }
          if (activePage < current) {
            return current - 1;
          }
        }
      });
    };
    goToPage();
    return () => {
      clearTimeout(timeout);
    };
  }, [activePage]);

  useFrame((_, delta) => {
    if (!bookGroupRef.current) return;

    let targetX = 0;
    if (isMobile) {
      targetX = -0.56;
    } else {
      if (delayedPage === 0) {
        targetX = -PAGE_WIDTH / 2;
      } else if (delayedPage === pages.length) {
        targetX = PAGE_WIDTH / 2;
      } else {
        targetX = 0;
      }
    }
    const targetY = isMobile ? -0.05 : 0;
    const targetScale = isMobile
      ? Math.min(1.05, Math.max(0.72, viewportWidth / 2.05))
      : 1;

    easing.damp3(
      bookGroupRef.current.position,
      [targetX, targetY, 0],
      0.35,
      delta
    );
    easing.damp3(
      bookGroupRef.current.scale,
      [targetScale, targetScale, targetScale],
      0.35,
      delta
    );
  });

  const handlePageClick = (number, opened, e, isMobile) => {
    if (isMobile) {
      if (e.uv && e.uv.x < 0.35) {
        setActivePage((p) => Math.max(0, p - 1));
      } else {
        setActivePage((p) => Math.min(pages.length, p + 1));
      }
    } else {
      setActivePage(opened ? number : number + 1);
    }
  };

  return (
    <group ref={bookGroupRef} {...props} rotation-y={-Math.PI / 2}>
      {pages.map((pageData, index) => (
        <Page
          key={index}
          page={delayedPage}
          number={index}
          totalPages={pages.length}
          texturePath={texturePath}
          onPageClick={handlePageClick}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === pages.length}
          {...pageData}
        />
      ))}
    </group>
  );
};

// Standalone complete Canvas component ready to drop into any page/project
export const BookCanvas = ({
  pages = defaultPages,
  page,
  onPageChange,
  texturePath = "/textures/",
  orbitControls = true,
  camera = { position: [0, 0.05, 3.1], fov: 42 },
  className = "",
  style = { width: "100%", height: "100%" },
  ...canvasProps
}) => {
  return (
    <div className={`book-canvas-container ${className}`.trim()} style={{ ...style }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
        camera={camera}
        {...canvasProps}
      >
        <group position-y={0}>
          <Suspense fallback={null}>
            <Book
              pages={pages}
              page={page}
              onPageChange={onPageChange}
              texturePath={texturePath}
            />
            {orbitControls && (
              <OrbitControls
                enablePan={true}
                enableZoom={true}
                minDistance={1.2}
                maxDistance={5}
                maxPolarAngle={Math.PI / 2 + 0.05}
                dampingFactor={0.05}
              />
            )}
            <Environment preset="studio" environmentIntensity={0.2} />
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[0, 4, 3.5]}
              intensity={0.65}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0001}
            />
            <directionalLight position={[-3, 2, 2]} intensity={0.25} />
            <directionalLight position={[3, 2, 2]} intensity={0.25} />
            <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
              <planeGeometry args={[100, 100]} />
              <shadowMaterial transparent opacity={0.15} />
            </mesh>
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
};

export default Book;
