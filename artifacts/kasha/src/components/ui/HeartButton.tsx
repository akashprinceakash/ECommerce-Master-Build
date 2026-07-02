import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/react";
import {
  useListLookbookSaved,
  getListLookbookSavedQueryKey,
  useSaveLookbookProduct,
  useUnsaveLookbookProduct,
} from "@workspace/api-client-react";
import { Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";

interface HeartButtonProps {
  productId: number;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
  showLabel?: boolean;
}

export function HeartButton({ productId, className = "", style, iconSize = 15, showLabel = false }: HeartButtonProps) {
  const [hovered, setHovered] = useState(false);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: savedIds = [] } = useListLookbookSaved({
    query: {
      enabled: !!user,
      queryKey: getListLookbookSavedQueryKey(),
      staleTime: 2 * 60 * 1000,
    },
  });

  const isSaved = savedIds.includes(productId);

  const save = useSaveLookbookProduct();
  const unsave = useUnsaveLookbookProduct();

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openSignIn();
      return;
    }

    const prev = queryClient.getQueryData<number[]>(getListLookbookSavedQueryKey());
    const currentCount = (prev ?? []).length;

    if (isSaved) {
      queryClient.setQueryData<number[]>(
        getListLookbookSavedQueryKey(),
        (old = []) => old.filter(id => id !== productId),
      );
      unsave.mutate({ productId }, {
        onError: () => queryClient.setQueryData(getListLookbookSavedQueryKey(), prev),
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListLookbookSavedQueryKey() }),
      });
    } else {
      queryClient.setQueryData<number[]>(
        getListLookbookSavedQueryKey(),
        (old = []) => [...old, productId],
      );
      save.mutate({ data: { productId } }, {
        onError: () => queryClient.setQueryData(getListLookbookSavedQueryKey(), prev),
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListLookbookSavedQueryKey() }),
      });

      if (currentCount === 0) {
        toast({
          title: "Added to your Lookbook ♥",
          description: "Keep building your outfit — add tops, bottoms and accessories to complete your look.",
          duration: 6000,
          action: (
            <ToastAction altText="Open Lookbook" onClick={() => navigate("/lookbook")}>
              Open Lookbook
            </ToastAction>
          ),
        });
      } else {
        toast({
          title: "Saved to Lookbook",
          description: "Visit your Lookbook to style your outfit.",
          duration: 3000,
          action: (
            <ToastAction altText="View Lookbook" onClick={() => navigate("/lookbook")}>
              View
            </ToastAction>
          ),
        });
      }
    }
  };

  const tooltipLabel = isSaved ? "Remove from Lookbook" : "Add to Lookbook";

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={toggle}
        className={className}
        aria-label={tooltipLabel}
        style={{ cursor: "pointer", lineHeight: 0, background: "none", border: "none", padding: 0, ...style }}
      >
        <Heart
          size={iconSize}
          fill={isSaved ? "#B8925A" : "none"}
          color={isSaved ? "#B8925A" : "rgba(0,0,0,0.52)"}
          strokeWidth={1.8}
          style={{ transition: "fill 0.2s ease, color 0.2s ease" }}
        />
      </button>

      {showLabel && (
        <span style={{
          fontFamily: "'Josefin Sans', sans-serif",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isSaved ? "#B8925A" : "rgba(0,0,0,0.52)",
          transition: "color 0.2s ease",
          userSelect: "none",
        }}>
          {isSaved ? "Saved" : "Lookbook"}
        </span>
      )}

      {!showLabel && hovered && (
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 7px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(15,22,34,0.93)",
          color: "#fff",
          fontFamily: "'Josefin Sans', sans-serif",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "5px 11px",
          borderRadius: 3,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 99,
          boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        }}>
          {tooltipLabel}
          <span style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid rgba(15,22,34,0.93)",
          }} />
        </span>
      )}
    </div>
  );
}
