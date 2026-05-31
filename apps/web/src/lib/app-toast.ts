import { toaster } from "@/components/ui/toaster";

export const appToast = {
  success(message: string, title = "Success") {
    toaster.create({
      type: "success",
      title,
      description: message,
      closable: true,
      duration: 4000,
    });
  },

  error(message: string, title = "Error") {
    toaster.create({
      type: "error",
      title,
      description: message,
      closable: true,
      duration: 6000,
    });
  },

  info(message: string, title = "Info") {
    toaster.create({
      type: "info",
      title,
      description: message,
      closable: true,
      duration: 4000,
    });
  },
};
