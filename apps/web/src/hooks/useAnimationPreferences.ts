import { useAuth } from "@/contexts/AuthContext";

export function useAnimationPreferences() {
  const { user } = useAuth();
  return {
    gifsEnabled: !user?.disable_gifs,
    loopAnimations: !!user?.loop_gifs,
  };
}
