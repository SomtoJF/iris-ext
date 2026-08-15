import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import {
  ChevronDown,
  FileScan,
  FileText,
  Globe,
  LaptopMinimalCheck,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { DetectedField } from "@/lib/types";
import type { Resume } from "@/services/resume";
import { patchJobApplication, markApplicationApplied } from "@/services/jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ContextPageChip {
  url: string;
  title: string;
}

interface OpenTabOption {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

interface Props {
  fields: DetectedField[];
  scanning: boolean;
  filling: boolean;
  syncing: boolean;
  tabId: number | null;
  unsyncedCount: number;
  applicationId: string | null;
  applicationResumeId: string | null;
  resumes: Resume[];
  onScan: () => void;
  onSync: () => void;
  onFill: (
    tabId: number,
    fields: DetectedField[],
    contextUrls: string[],
  ) => void;
  onApplicationResumeChange: (resumeId: string) => void;
  applied?: boolean;
  onMarkedApplied?: () => void;
}

const MAX_CONTEXT_URLS = 3;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function FieldsComposer({
  fields,
  scanning,
  filling,
  syncing,
  tabId,
  unsyncedCount,
  applicationId,
  applicationResumeId,
  resumes,
  onScan,
  onSync,
  onFill,
  onApplicationResumeChange,
  applied = false,
  onMarkedApplied,
}: Props) {
  const emptyFields = fields.filter((f) => f.value.trim() === "");
  const [contextPages, setContextPages] = useState<ContextPageChip[]>([]);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeQuery, setResumeQuery] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [markingApplied, setMarkingApplied] = useState(false);
  const [markAppliedError, setMarkAppliedError] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [tabsQuery, setTabsQuery] = useState("");
  const [openTabs, setOpenTabs] = useState<OpenTabOption[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);

  const effectiveResumeId =
    applicationResumeId ?? resumes.find((r) => r.isActive)?.id ?? null;
  const selectedResume = resumes.find((r) => r.id === effectiveResumeId);

  const resumeFuse = useMemo(
    () =>
      new Fuse(resumes, {
        keys: ["fileName"],
        threshold: 0.4,
      }),
    [resumes],
  );

  const filteredResumes = useMemo(() => {
    const q = resumeQuery.trim();
    if (!q) return resumes;
    return resumeFuse.search(q).map((r) => r.item);
  }, [resumeFuse, resumeQuery, resumes]);

  const tabsFuse = useMemo(
    () =>
      new Fuse(openTabs, {
        keys: ["title", "url"],
        threshold: 0.4,
      }),
    [openTabs],
  );

  const filteredTabs = useMemo(() => {
    const q = tabsQuery.trim();
    if (!q) return openTabs;
    return tabsFuse.search(q).map((r) => r.item);
  }, [tabsFuse, tabsQuery, openTabs]);

  useEffect(() => {
    if (!plusOpen) {
      setTabsQuery("");
      return;
    }
    let cancelled = false;
    setTabsLoading(true);
    browser.tabs
      .query({})
      .then((tabs) => {
        if (cancelled) return;
        const options: OpenTabOption[] = [];
        for (const tab of tabs) {
          if (tab.id == null || !tab.url || !/^https?:/.test(tab.url)) continue;
          options.push({
            id: tab.id,
            url: tab.url,
            title: tab.title?.trim() || tab.url,
            favIconUrl: tab.favIconUrl,
          });
        }
        setOpenTabs(options);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setTabsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plusOpen]);

  async function handleSelectResume(id: string) {
    if (applicationId == null || id === effectiveResumeId) {
      setResumeOpen(false);
      return;
    }
    try {
      setResumeLoading(true);
      await patchJobApplication(applicationId, { resumeId: id });
      onApplicationResumeChange(id);
      setResumeOpen(false);
      setResumeQuery("");
    } catch (e) {
      console.error(e);
    } finally {
      setResumeLoading(false);
    }
  }

  function toggleContextPage(tab: OpenTabOption) {
    setContextPages((prev) => {
      if (prev.some((p) => p.url === tab.url)) {
        return prev.filter((p) => p.url !== tab.url);
      }
      if (prev.length >= MAX_CONTEXT_URLS) return prev;
      return [...prev, { url: tab.url, title: tab.title }];
    });
    setPlusOpen(false);
  }

  function removeContextPage(url: string) {
    setContextPages((prev) => prev.filter((p) => p.url !== url));
  }

  function handleFill() {
    if (tabId == null) return;
    onFill(
      tabId,
      emptyFields,
      contextPages.map((p) => p.url),
    );
  }

  async function handleMarkAsApplied() {
    if (applicationId == null || applied || markingApplied) return;
    const confirmed = window.confirm(
      "Mark this application as applied? Please sync your application data first. After marking as applied, you won't be able to edit it.",
    );
    if (!confirmed) return;

    setMarkAppliedError(null);
    setMarkingApplied(true);
    try {
      await markApplicationApplied(applicationId);
      onMarkedApplied?.();
    } catch (e) {
      setMarkAppliedError(e instanceof Error ? e.message : String(e));
    } finally {
      setMarkingApplied(false);
    }
  }

  return (
    <div className="shrink-0 border-t bg-background p-3">
      <div className="relative">
        <div className="mb-1.5 flex  gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative gap-1"
                />
              }
            >
              <MoreHorizontal className="size-4" />
              Actions
              <ChevronDown className="size-3 opacity-60" />
              {unsyncedCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {unsyncedCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem disabled={scanning} onClick={() => onScan()}>
                <FileScan className="size-4" />
                {scanning
                  ? "Scanning…"
                  : fields.length > 0
                    ? "Rescan page"
                    : "Scan this page"}
              </DropdownMenuItem>
              {unsyncedCount > 0 && (
                <DropdownMenuItem disabled={syncing} onClick={() => onSync()}>
                  <RefreshCcw className="size-4" />
                  {syncing ? "Syncing…" : `Sync (${unsyncedCount})`}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            disabled={
              markingApplied || filling || applied || applicationId == null
            }
            onClick={handleMarkAsApplied}
            className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
          >
            <LaptopMinimalCheck className="size-3.5" />
            {applied
              ? "Applied"
              : markingApplied
                ? "Marking…"
                : "Mark as applied"}
          </Button>
        </div>
        {markAppliedError && (
          <p className="mb-1.5 text-xs text-red-600">{markAppliedError}</p>
        )}

        <Card size="sm" className="gap-2 py-2">
          <CardContent className="flex flex-col gap-2 px-2.5">
            <div className="flex max-h-24 flex-wrap items-center gap-1.5 overflow-y-auto">
              <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 hover:bg-violet-100"
                    />
                  }
                >
                  <FileText className="size-3 shrink-0" />
                  <span className="truncate">
                    {selectedResume?.fileName ?? "Select resume"}
                  </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2" side="top">
                  <Input
                    value={resumeQuery}
                    onChange={(e) => setResumeQuery(e.target.value)}
                    placeholder="Search resumes…"
                    className="mb-2 h-7 text-xs"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredResumes.length === 0 ? (
                      <p className="px-1.5 py-2 text-xs text-muted-foreground">
                        {resumes.length === 0
                          ? "No resumes uploaded yet"
                          : "No matches"}
                      </p>
                    ) : (
                      filteredResumes.map((resume) => {
                        const selected = resume.id === effectiveResumeId;
                        return (
                          <button
                            key={resume.id}
                            type="button"
                            disabled={resumeLoading || applicationId == null}
                            onClick={() => handleSelectResume(resume.id)}
                            className={`flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50 ${
                              selected ? "bg-violet-50 text-violet-800" : ""
                            }`}
                          >
                            <span className="truncate font-medium">
                              {resume.fileName}
                            </span>
                            {selected && (
                              <Badge
                                variant="secondary"
                                className="ml-1 shrink-0"
                              >
                                Active
                              </Badge>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {contextPages.map((page) => (
                <span
                  key={page.url}
                  title={page.url}
                  className="inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs"
                >
                  <Globe className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{truncate(page.title, 28)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${page.title}`}
                    onClick={() => removeContextPage(page.url)}
                    className="rounded-full p-0.5 hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}

              <Popover open={plusOpen} onOpenChange={setPlusOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="rounded-sm border-gray-200 bg-gray-50 hover:bg-gray-100 p-0"
                      aria-label="Add context"
                    />
                  }
                >
                  <Plus className="size-3.5" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-2" side="top">
                  <Input
                    value={tabsQuery}
                    onChange={(e) => setTabsQuery(e.target.value)}
                    placeholder="Search tabs…"
                    className="mb-1 h-7 text-xs"
                    autoFocus
                  />
                  <p className="mb-1 px-1.5 text-xs font-medium text-muted-foreground">
                    Open tabs
                  </p>
                  <div className="relative">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-popover to-transparent"
                    />
                    <div className="max-h-52 overflow-y-auto">
                      {tabsLoading ? (
                        <p className="px-1.5 py-2 text-xs text-muted-foreground">
                          Loading tabs…
                        </p>
                      ) : openTabs.length === 0 ? (
                        <p className="px-1.5 py-2 text-xs text-muted-foreground">
                          No http(s) tabs open
                        </p>
                      ) : filteredTabs.length === 0 ? (
                        <p className="px-1.5 py-2 text-xs text-muted-foreground">
                          No matches
                        </p>
                      ) : (
                        filteredTabs.map((tab) => {
                          const alreadyAdded = contextPages.some(
                            (p) => p.url === tab.url,
                          );
                          const atLimit =
                            contextPages.length >= MAX_CONTEXT_URLS;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              disabled={!alreadyAdded && atLimit}
                              title={tab.url}
                              onClick={() => toggleContextPage(tab)}
                              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-40"
                            >
                              {tab.favIconUrl ? (
                                <img
                                  src={tab.favIconUrl}
                                  alt=""
                                  className="size-3.5 shrink-0"
                                />
                              ) : (
                                <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {tab.title}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={
                  filling ||
                  applied ||
                  emptyFields.length === 0 ||
                  tabId == null
                }
                onClick={handleFill}
                className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
              >
                <Sparkles className="size-3.5" />
                {filling
                  ? "Filling…"
                  : emptyFields.length === 0
                    ? "All fields filled"
                    : `Fill (${emptyFields.length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
