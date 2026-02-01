"use client";

import { useState, useEffect, useTransition } from "react";
import { authClient } from "@/lib/auth/client";
import { createApiKey, deleteApiKey } from "@/app/actions/api-keys";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Key, Plus, Trash2, Copy, Check, AlertCircle, ChevronDownIcon, X } from "lucide-react";
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from "@/lib/rbac";

interface ApiKey {
  id: string;
  name: string | null;
  prefix: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  permissions: Record<string, string[]> | null;
}

interface ApiKeyManagerProps {
  userPermissions: Permission[];
}

export function ApiKeyManager({ userPermissions }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [keyName, setKeyName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());

  const fetchApiKeys = async () => {
    try {
      setIsLoading(true);
      const result = await authClient.apiKey.list();
      if (result.error) {
        setError(result.error.message || "Failed to fetch API keys");
        return;
      }
      setApiKeys((result.data as ApiKey[]) || []);
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
      setError("Failed to fetch API keys");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      setError("Key name is required");
      return;
    }

    if (selectedPermissions.size === 0) {
      setError("At least one permission is required");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        // Calculate expiresIn in seconds if expiry date is set
        let expiresInSeconds: number | undefined;
        if (expiresAt) {
          const expiryDate = new Date(expiresAt);
          const now = new Date();
          expiresInSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
          if (expiresInSeconds <= 0) {
            setError("Expiration date must be in the future");
            return;
          }
        }

        // Use server action to create API key (permissions can only be set server-side)
        const result = await createApiKey({
          name: keyName.trim(),
          expiresInSeconds,
          permissions: Array.from(selectedPermissions),
        });

        if (!result.success) {
          setError(result.error || "Failed to create API key");
          return;
        }

        // Show the key value (only shown once!)
        setNewKeyValue(result.key || null);

        // Refresh the list
        await fetchApiKeys();
      } catch (err) {
        console.error("Failed to create API key:", err);
        setError("Failed to create API key");
      }
    });
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        // Use server action to delete API key
        const result = await deleteApiKey(keyId);
        if (!result.success) {
          setError(result.error || "Failed to delete API key");
          return;
        }
        await fetchApiKeys();
      } catch (err) {
        console.error("Failed to delete API key:", err);
        setError("Failed to delete API key");
      }
    });
  };

  const handleCopyKey = async () => {
    if (newKeyValue) {
      await navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseCreateDialog = () => {
    setIsCreateOpen(false);
    setKeyName("");
    setExpiresAt("");
    setSelectedPermissions(new Set());
    setNewKeyValue(null);
    setError(null);
  };

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  // Get available permission groups (filtered by what user has)
  const getAvailableGroups = () => {
    const groups: { key: string; label: string; permissions: Permission[] }[] = [];
    for (const [key, group] of Object.entries(PERMISSION_GROUPS)) {
      const available = group.permissions.filter((p) => userPermissions.includes(p));
      if (available.length > 0) {
        groups.push({ key, label: group.label, permissions: available as Permission[] });
      }
    }
    return groups;
  };

  const formatPermissions = (
    permissions: Record<string, string[]> | null,
  ): { key: string; label: string }[] => {
    if (!permissions) return [];
    const result: { key: string; label: string }[] = [];
    for (const [resource, actions] of Object.entries(permissions)) {
      for (const action of actions) {
        const key = `${resource}:${action}` as Permission;
        result.push({
          key,
          label: PERMISSION_LABELS[key] || key,
        });
      }
    }
    return result;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center justify-center py-8">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Create and manage API keys for programmatic access to the quiz API.
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger className={cn(buttonVariants(), "gap-1.5")}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:block">Create Key</span>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              {newKeyValue ? (
                <>
                  <DialogHeader>
                    <DialogTitle>API Key Created</DialogTitle>
                    <DialogDescription>
                      Copy your API key now. You won&apos;t be able to see it again!
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input value={newKeyValue} readOnly className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={handleCopyKey}>
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Store this key securely. It will only be shown once and cannot be retrieved
                        later.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseCreateDialog}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Create a new API key with specific permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Name</Label>
                      <Input
                        id="keyName"
                        placeholder="My API Key"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-3">
                        <Label htmlFor="expire-date-picker" className="px-1">
                          Expiration (optional)
                        </Label>
                        <Popover>
                          <PopoverTrigger
                            id="expire-date-picker"
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "w-32 justify-between font-normal",
                            )}
                          >
                            {expiresAt ? new Date(expiresAt).toLocaleDateString() : "Select date"}
                            <ChevronDownIcon />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                            <Calendar
                              mode="single"
                              captionLayout="dropdown"
                              selected={expiresAt ? new Date(expiresAt) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const existing = expiresAt ? new Date(expiresAt) : new Date();
                                  date.setHours(existing.getHours(), existing.getMinutes());
                                  setExpiresAt(date.toISOString());
                                } else {
                                  setExpiresAt("");
                                }
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-col gap-3">
                        <Label htmlFor="expire-time-picker" className="px-1">
                          Time
                        </Label>
                        <Input
                          type="time"
                          id="expire-time-picker"
                          className="bg-background w-28 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                          value={
                            expiresAt
                              ? `${String(new Date(expiresAt).getHours()).padStart(2, "0")}:${String(new Date(expiresAt).getMinutes()).padStart(2, "0")}`
                              : ""
                          }
                          onChange={(e) => {
                            if (e.target.value && expiresAt) {
                              const [hours, minutes] = e.target.value.split(":").map(Number);
                              const newDate = new Date(expiresAt);
                              newDate.setHours(hours, minutes);
                              setExpiresAt(newDate.toISOString());
                            }
                          }}
                          disabled={!expiresAt}
                        />
                      </div>
                      {expiresAt && (
                        <div className="flex flex-col gap-3">
                          <Label className="px-1 opacity-0">Clear</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setExpiresAt("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label>Permissions</Label>
                      <p className="text-muted-foreground text-xs">
                        You can only grant permissions that you have.
                      </p>
                      <div className="scrollbar-hidden max-h-64 space-y-4 overflow-x-hidden overflow-y-auto">
                        {getAvailableGroups().map((group) => (
                          <div key={group.key} className="space-y-2">
                            <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                              {group.label}
                            </h4>
                            <div className="space-y-1">
                              {group.permissions.map((permission) => (
                                <div
                                  key={permission}
                                  className="mr-1 flex items-center justify-between py-0.5"
                                >
                                  <Label
                                    htmlFor={`perm-${permission}`}
                                    className="cursor-pointer text-sm"
                                    style={{ fontWeight: 400 }}
                                  >
                                    {PERMISSION_LABELS[permission]}
                                  </Label>
                                  <Switch
                                    id={`perm-${permission}`}
                                    checked={selectedPermissions.has(permission)}
                                    onCheckedChange={() => togglePermission(permission)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseCreateDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateKey} disabled={isPending}>
                      {isPending ? "Creating..." : "Create Key"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error && !isCreateOpen && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {apiKeys.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            No API keys yet. Create one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key Prefix</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name || "Unnamed"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {key.prefix ? `${key.prefix}...` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {formatPermissions(key.permissions).map((perm) => (
                        <Badge key={perm.key} variant="secondary" className="text-xs">
                          {perm.label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteKey(key.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
