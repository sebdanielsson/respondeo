"use client";

import { useState, useEffect, useTransition } from "react";
import { authClient } from "@/lib/auth/client";
import { createApiKey, deleteApiKey } from "@/app/actions/api-keys";
import { Button } from "@/components/ui/button";
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
import { Key, Plus, Trash2, Copy, Check, AlertCircle } from "lucide-react";
import { API_SCOPES, type ApiScope, ALL_API_SCOPES } from "@/lib/auth/scopes";

interface ApiKey {
  id: string;
  name: string | null;
  prefix: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  permissions: Record<string, string[]> | null;
}

const SCOPE_LABELS: Record<ApiScope, string> = {
  [API_SCOPES.QUIZZES_READ]: "Read Quizzes",
  [API_SCOPES.QUIZZES_WRITE]: "Write Quizzes",
  [API_SCOPES.ATTEMPTS_READ]: "Read Attempts",
  [API_SCOPES.ATTEMPTS_WRITE]: "Write Attempts",
};

export function ApiKeyManager() {
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
  const [selectedScopes, setSelectedScopes] = useState<Set<ApiScope>>(new Set());

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

    if (selectedScopes.size === 0) {
      setError("At least one permission is required");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        // Convert scopes to BetterAuth permission format
        // e.g., { quizzes: ["read", "write"], attempts: ["read"] }
        const permissions: Record<string, string[]> = {};
        for (const scope of selectedScopes) {
          const [resource, action] = scope.split(":");
          if (!permissions[resource]) {
            permissions[resource] = [];
          }
          permissions[resource].push(action);
        }

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
          permissions,
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
    setSelectedScopes(new Set());
    setNewKeyValue(null);
    setError(null);
  };

  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const formatPermissions = (permissions: Record<string, string[]> | null): string[] => {
    if (!permissions) return [];
    const scopes: string[] = [];
    for (const [resource, actions] of Object.entries(permissions)) {
      for (const action of actions) {
        scopes.push(`${resource}:${action}`);
      }
    }
    return scopes;
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
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Create Key</span>
              </Button>
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
                    <div className="space-y-2">
                      <Label htmlFor="expiresAt">Expiration (optional)</Label>
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label>Permissions</Label>
                      <div className="space-y-2">
                        {ALL_API_SCOPES.map((scope) => (
                          <div key={scope} className="flex items-center justify-between">
                            <Label
                              htmlFor={`scope-${scope}`}
                              className="cursor-pointer font-normal"
                            >
                              {SCOPE_LABELS[scope]}
                            </Label>
                            <Switch
                              id={`scope-${scope}`}
                              checked={selectedScopes.has(scope)}
                              onCheckedChange={() => toggleScope(scope)}
                            />
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
                      {formatPermissions(key.permissions).map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
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
