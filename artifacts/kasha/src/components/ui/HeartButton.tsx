import { useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/react";
import {
  useListLookbookSaved,
  getListLookbookSavedQueryKey,
  useSaveLookbookProduct,
  useUnsaveLookbookProduct,
} from "@workspace/api-client-react";
import { Heart } from "lucide-react";

interface HeartButtonProps {
  productId: number;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
}

export function HeartButton({ productId, className = "", style, iconSize = 15 }: HeartButtonProps) {
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const queryClient = useQueryClient();

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
    }
  };

  return (
    <button
      onClick={toggle}
      className={className}
      title={isSaved ? "Remove from Lookbook" : "Save to Lookbook"}
      aria-label={isSaved ? "Remove from Lookbook" : "Save to Lookbook"}
      style={{ cursor: "pointer", lineHeight: 0, ...style }}
    >
      <Heart
        size={iconSize}
        fill={isSaved ? "#B8925A" : "none"}
        color={isSaved ? "#B8925A" : "rgba(0,0,0,0.52)"}
        strokeWidth={1.8}
        style={{ transition: "fill 0.2s ease, color 0.2s ease" }}
      />
    </button>
  );
}
