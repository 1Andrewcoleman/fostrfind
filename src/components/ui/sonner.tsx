"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          // Status tints borrow from the three-pastel palette where the
          // semantic map is clean: sage (--warm) for success, destructive
          // token for error. Warning and info stay as muted neutrals rather
          // than inventing a fourth brand pastel — see `.impeccable.md`
          // principle 4 ("three pastels, each with a job").
          success:
            "group-[.toaster]:!border-warm/40 group-[.toaster]:!bg-warm/15 group-[.toaster]:!text-foreground",
          error:
            "group-[.toaster]:!border-destructive/40 group-[.toaster]:!bg-destructive/10 group-[.toaster]:!text-foreground",
          warning:
            "group-[.toaster]:!border-peach/50 group-[.toaster]:!bg-peach/20 group-[.toaster]:!text-foreground",
          info:
            "group-[.toaster]:!border-border group-[.toaster]:!bg-muted group-[.toaster]:!text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
