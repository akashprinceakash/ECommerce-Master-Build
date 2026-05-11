import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const TEX_W = 2048;
const TEX_H = 2048;

type Pos =
  | "top-left" | "top-center" | "top-right"
  | "mid-left" | "center" | "mid-right"
  | "bot-left" | "bot-center" | "bot-right";

const LOGO_POS_MAP: Record<Pos, { rx: number; ry: number }> = {
  "top-left":   { rx: 0.05, ry: 0.05 },
  "top-center": { rx: 0.30, ry: 0.05 },
  "top-right":  { rx: 0.55, ry: 0.05 },
  "mid-left":   { rx: 0.05, ry: 0.30 },
  "center":     { rx: 0.30, ry: 0.30 },
  "mid-right":  { rx: 0.55, ry: 0.30 },
  "bot-left":   { rx: 0.05, ry: 0.60 },
  "bot-center": { rx: 0.30, ry: 0.60 },
  "bot-right":  { rx: 0.55, ry: 0.60 },
};

export type Part = "collar" | "front" | "back" | "sleeves";
export type PartColors = Record<Part, string>;

interface Props {
  partColors: PartColors;
  sleeveType: "half" | "full";
  logoData: string | null;
  logoPosition: Pos;
  logoSize: number;
  modelUrl?: string;
  height?: number;
}

function buildShirtTexture(
  partColors: PartColors,
  logoImg: HTMLImageElement | null,
  logoPosition: Pos,
  logoSize: number,
  sleeveType: "half" | "full"
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d")!;

  const W = TEX_W;
  const H = TEX_H;

  const COLLAR_H = Math.floor(H * 0.08);
  const BODY_H = Math.floor(H * 0.52);
  const BACK_Y = COLLAR_H + BODY_H;
  const BACK_H = H - BACK_Y;

  const SLEEVE_W = Math.floor(W * 0.18);
  const FRONT_X = SLEEVE_W;
  const FRONT_W = W - SLEEVE_W * 2;

  ctx.fillStyle = partColors.front;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = partColors.collar;
  ctx.fillRect(0, 0, W, COLLAR_H);

  ctx.fillStyle = partColors.sleeves;
  ctx.fillRect(0, COLLAR_H, SLEEVE_W, BODY_H);
  ctx.fillRect(W - SLEEVE_W, COLLAR_H, SLEEVE_W, BODY_H);

  ctx.fillStyle = partColors.back;
  ctx.fillRect(0, BACK_Y, W, BACK_H);

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, COLLAR_H); ctx.lineTo(W, COLLAR_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(SLEEVE_W, COLLAR_H); ctx.lineTo(SLEEVE_W, COLLAR_H + BODY_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - SLEEVE_W, COLLAR_H); ctx.lineTo(W - SLEEVE_W, COLLAR_H + BODY_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, BACK_Y); ctx.lineTo(W, BACK_Y); ctx.stroke();
  ctx.globalAlpha = 1;

  if (sleeveType === "half") {
    const maskY = COLLAR_H + Math.floor(BODY_H * 0.45);
    const maskH = Math.floor(BODY_H * 0.55);
    ctx.fillStyle = partColors.front;
    ctx.fillRect(0, maskY, SLEEVE_W, maskH);
    ctx.fillRect(W - SLEEVE_W, maskY, SLEEVE_W, maskH);
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, maskY); ctx.lineTo(SLEEVE_W, maskY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - SLEEVE_W, maskY); ctx.lineTo(W, maskY); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (logoImg) {
    const pos = LOGO_POS_MAP[logoPosition] || LOGO_POS_MAP["top-center"];
    const frontAreaX = FRONT_X;
    const frontAreaY = COLLAR_H;
    const frontAreaW = FRONT_W;
    const frontAreaH = BODY_H;

    const maxLogoW = frontAreaW * (logoSize / 100) * 0.7;
    const maxLogoH = frontAreaH * (logoSize / 100) * 0.5;

    const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
    let logoW: number, logoH: number;
    if (ratio > 1) {
      logoW = maxLogoW;
      logoH = logoW / ratio;
    } else {
      logoH = maxLogoH;
      logoW = logoH * ratio;
    }

    const logoX = frontAreaX + pos.rx * frontAreaW;
    const logoY = frontAreaY + pos.ry * frontAreaH;

    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
  }

  return canvas;
}

export default function TShirtViewer3D({
  partColors,
  sleeveType,
  logoData,
  logoPosition,
  logoSize,
  modelUrl = "/collar_t-shirt_model.glb",
  height = 380,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const shirtMeshRef = useRef<THREE.Object3D | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!logoData) {
      logoImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => { logoImgRef.current = img; };
    img.src = logoData;
  }, [logoData]);

  const rebuildTexture = useCallback(() => {
    if (!shirtMeshRef.current || !partColors) return;

    const canvas = buildShirtTexture(
      partColors,
      logoImgRef.current,
      logoPosition,
      logoSize,
      sleeveType
    );

    if (textureRef.current) textureRef.current.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.needsUpdate = true;
    textureRef.current = tex;

    shirtMeshRef.current.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (child.material.name !== "Button") {
          child.material.map = tex;
          child.material.color.set(0xffffff);
          child.material.needsUpdate = true;
        }
      }
    });
  }, [partColors, logoPosition, logoSize, sleeveType]);

  useEffect(() => {
    rebuildTexture();
  }, [rebuildTexture]);

  useEffect(() => {
    if (!logoData) return;
    const tid = setTimeout(() => rebuildTexture(), 300);
    return () => clearTimeout(tid);
  }, [logoData, rebuildTexture]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (err) {
      console.warn("WebGL not available:", err);
      setLoadError("3D preview not supported in this browser");
      setIsLoading(false);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafaf7);
    sceneRef.current = scene;

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight || height;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
    camera.position.set(0, 0.1, 2.4);
    cameraRef.current = camera;

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.8;
    controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff0d8, 1.8);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.7);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xb8925a, 0.6);
    rim.position.set(0, -2, -3);
    scene.add(rim);

    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.85;
    ground.receiveShadow = true;
    scene.add(ground);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(sz.x, sz.y, sz.z);
        const scale = 1.6 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);
        shirtMeshRef.current = model;
        setIsLoading(false);

        const canvas = buildShirtTexture(
          partColors,
          logoImgRef.current,
          logoPosition,
          logoSize,
          sleeveType
        );
        const tex = new THREE.CanvasTexture(canvas);
        tex.flipY = false;
        tex.needsUpdate = true;
        textureRef.current = tex;

        model.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.name !== "Button") {
            child.material.map = tex;
            child.material.color.set(0xffffff);
            child.material.needsUpdate = true;
          }
        });
      },
      undefined,
      (error) => {
        console.error("Error loading model:", error);
        setLoadError("Failed to load 3D model");
        setIsLoading(false);
      }
    );

    let autoRotate = true;
    const onPointerDown = () => { autoRotate = false; };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const animate = () => {
      if (disposed) return;
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      if (autoRotate && shirtMeshRef.current) {
        shirtMeshRef.current.rotation.y += 0.004;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!containerRef.current) return;
      const w2 = containerRef.current.clientWidth;
      const h2 = containerRef.current.clientHeight || height;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      // Recursively dispose scene geometries/materials to free GPU resources
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      if (textureRef.current) textureRef.current.dispose();
      textureRef.current = null;
      shirtMeshRef.current = null;
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 8,
        overflow: "hidden",
        background: "#FAFAF7",
        border: "1px solid rgba(184,146,90,0.2)",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "rgba(250,250,247,0.92)",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(0,0,0,0.72)",
            fontFamily: "'Josefin Sans', sans-serif",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              border: "2px solid rgba(0,0,0,0.12)",
              borderTopColor: "#B8925A",
              borderRadius: "50%",
              animation: "tsv-spin 0.9s linear infinite",
            }}
          />
          <span>Loading 3D model</span>
          <style>{`@keyframes tsv-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {loadError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(250,250,247,0.92)",
            color: "#C03A39",
            fontSize: 12,
            fontFamily: "'Josefin Sans', sans-serif",
          }}
        >
          ⚠ {loadError}
        </div>
      )}
    </div>
  );
}
