import React from "react";
import { useTheme } from "next-themes";
import { GooeyToaster, gooeyToast } from "goey-toast";

type ToasterProps = React.ComponentProps<typeof GooeyToaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <GooeyToaster
      theme={theme as ToasterProps["theme"]}
      bounce={0.45}
      preset="smooth"
      swipeToDismiss
      showProgress
      closeButton="top-right"
      {...props}
    />
  );
};

export { Toaster, gooeyToast as toast, gooeyToast };
