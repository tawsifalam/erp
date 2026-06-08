"use client";

import { useState, type ComponentProps } from "react";
import { Box, IconButton, Input, Text } from "@chakra-ui/react";
import { FormField } from "@erp/ui";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-2.16 3.19" />
      <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 7 10 7a10.66 10.66 0 0 0 5.39-1.45" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function PasswordInput({ w, width, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const fullWidth = w ?? width ?? "full";

  return (
    <Box position="relative" w={fullWidth}>
      <Input
        {...props}
        w={fullWidth}
        type={visible ? "text" : "password"}
        pr="2.75rem"
      />
      <IconButton
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        variant="ghost"
        size="sm"
        position="absolute"
        right="1"
        top="50%"
        transform="translateY(-50%)"
        color="fg.muted"
        minW="auto"
        h="auto"
        p={1}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </IconButton>
    </Box>
  );
}

type PasswordWithConfirmFieldsProps = {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  passwordLabel?: string;
  confirmLabel?: string;
  minLength?: number;
  passwordAutoComplete?: string;
  confirmAutoComplete?: string;
};

export function PasswordWithConfirmFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  passwordLabel = "Password",
  confirmLabel = "Confirm password",
  minLength = 8,
  passwordAutoComplete = "new-password",
  confirmAutoComplete = "new-password",
}: PasswordWithConfirmFieldsProps) {
  const showMismatch =
    confirmPassword.length > 0 && password.length > 0 && password !== confirmPassword;

  return (
    <>
      <FormField label={passwordLabel}>
        <PasswordInput
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={passwordAutoComplete}
        />
      </FormField>
      <FormField label={confirmLabel}>
        <PasswordInput
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={confirmAutoComplete}
        />
        {showMismatch && (
          <Text fontSize="xs" color="red.500" mt={1}>
            Passwords do not match
          </Text>
        )}
      </FormField>
    </>
  );
}

export function validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  return null;
}
