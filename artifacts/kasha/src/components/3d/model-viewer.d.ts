import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean | string;
        "auto-rotate"?: boolean | string;
        "rotation-per-second"?: string;
        "interaction-prompt"?: string;
        "shadow-intensity"?: string | number;
        "environment-image"?: string;
        exposure?: string | number;
        "tone-mapping"?: string;
        scale?: string;
        "poster-color"?: string;
        "camera-orbit"?: string;
        "field-of-view"?: string;
        "min-camera-orbit"?: string;
        "max-camera-orbit"?: string;
        poster?: string;
        id?: string;
        style?: React.CSSProperties;
        ref?: React.Ref<any>;
      };
    }
  }
}
