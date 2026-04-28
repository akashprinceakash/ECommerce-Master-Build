import { useRef, Component, type ReactNode, type ErrorInfo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows, Center } from "@react-three/drei";
import * as THREE from "three";

interface ProductViewerProps {
  color?: string;
  partsEnabled?: Record<string, boolean>;
  thumbnailUrl?: string | null;
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function PlaceholderMesh({ color = "#ffffff", partsEnabled = {} }: Omit<ProductViewerProps, "thumbnailUrl">) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[1, 1.5, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
      </mesh>

      {partsEnabled.leftSleeve !== false && (
        <mesh position={[-0.7, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.4, 1, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
        </mesh>
      )}

      {partsEnabled.rightSleeve !== false && (
        <mesh position={[0.7, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.4, 1, 0.4]} />
          <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
        </mesh>
      )}

      {partsEnabled.collar !== false && (
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.35, 0.2, 32]} />
          <meshStandardMaterial color={color} roughness={0.8} metalness={0.2} />
        </mesh>
      )}
    </group>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function ImageFallback({ thumbnailUrl, color }: { thumbnailUrl?: string | null; color?: string }) {
  return (
    <div
      className="w-full h-full min-h-[500px] flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#f5f0e8" }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Product preview"
          className="w-full h-full object-contain"
          style={{ maxHeight: "500px" }}
        />
      ) : (
        <div className="text-center text-muted-foreground">
          <div className="w-24 h-32 mx-auto mb-4 rounded-sm" style={{ backgroundColor: color ?? "#c9a86c" }} />
          <p className="text-xs tracking-widest font-medium uppercase">3D Preview</p>
          <p className="text-xs mt-1 opacity-60">Available in supported browsers</p>
        </div>
      )}
    </div>
  );
}

export function ProductViewer({ color = "#ffffff", partsEnabled = {}, thumbnailUrl }: ProductViewerProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  if (webglAvailable === null) {
    return (
      <div className="w-full h-full min-h-[500px] bg-secondary/30 animate-pulse" />
    );
  }

  if (!webglAvailable) {
    return <ImageFallback thumbnailUrl={thumbnailUrl} color={color} />;
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-secondary/30 relative">
      <WebGLErrorBoundary fallback={<ImageFallback thumbnailUrl={thumbnailUrl} color={color} />}>
        <Canvas shadows camera={{ position: [0, 0, 4], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          <Center>
            <PlaceholderMesh color={color} partsEnabled={partsEnabled} />
          </Center>
          <ContactShadows position={[0, -1.2, 0]} opacity={0.4} scale={10} blur={2} far={4} />
          <Environment preset="studio" />
          <OrbitControls
            enablePan={false}
            minDistance={2}
            maxDistance={6}
            autoRotate={false}
            maxPolarAngle={Math.PI / 2 + 0.1}
          />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
