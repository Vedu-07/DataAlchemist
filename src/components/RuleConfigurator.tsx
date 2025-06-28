"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Rule,
  NaturalLanguageRule,
  GeminiRuleConversionResponse,
  CoRunRule,
  SlotRestrictionRule,
  LoadLimitRule,
  PhaseWindowRule,
  PatternMatchRule,
  PrecedenceOverrideRule,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FiPlusCircle,
  FiZap,
  FiTrash2,
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
  FiLoader,
  FiToggleLeft,
  FiToggleRight,
  FiInfo,
  FiDownload,
  FiChevronDown,
  FiChevronUp,
  FiCopy,
} from "react-icons/fi";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { toast } from "sonner";

const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

const getInitialNewRule = (): Omit<
  Rule,
  "id" | "source" | "description" | "type"
> & { type: string | ""; description: string } => ({
  type: "",
  description: "",
  isEnabled: true,
});

const RuleConfigurator: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [nlPrompt, setNlPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null); // Rule currently being edited
  const [formRule, setFormRule] = useState<any>(getInitialNewRule()); // Rule data in the form

  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const visibleRules = useMemo(
    () => rules.filter((rule) => rule.type !== "precedenceOverride"),
    [rules]
  );
  const currentPrecedenceRule = useMemo(
    () =>
      rules.find((rule) => rule.type === "precedenceOverride") as
        | PrecedenceOverrideRule
        | undefined,
    [rules]
  );

  React.useEffect(() => {
    if (isDialogOpen) {
      if (editingRule) {
        setFormRule({ ...editingRule });
      } else {
        setFormRule(getInitialNewRule());
      }
    }
  }, [isDialogOpen, editingRule]);

  const ruleTypeOptions = useMemo(
    () => [
      { value: "coRun", label: "Co-Run Tasks" },
      { value: "slotRestriction", label: "Slot Restriction" },
      { value: "loadLimit", label: "Load Limit" },
      { value: "phaseWindow", label: "Phase Window" },
      { value: "patternMatch", label: "Pattern Match" },
    ],
    []
  );

  const toggleRuleExpansion = useCallback((ruleId: string) => {
    setExpandedRules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  }, []);

  const copyToClipboard = useCallback((text: string, message: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast.success(message);
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          toast.error("Copy failed: Please manually select and copy.");
        });
    } else if (document.execCommand) {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast.success(message);
    } else {
      toast.error(
        "Copy failed: Your browser does not support clipboard access."
      );
    }
  }, []);

  const handleFormChange = useCallback((field: string, value: any) => {
    setFormRule((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveRule = useCallback(() => {
    if (!formRule.type || !formRule.description.trim()) {
      toast.error("Rule Type and Description are required.");
      return;
    }

    const newOrUpdatedRule: Rule = {
      ...formRule,
      id: editingRule ? editingRule.id : generateUniqueId(),
      source: editingRule ? editingRule.source : "manual",
    };

    setRules((prevRules) => {
      if (editingRule) {
        return prevRules.map((rule) =>
          rule.id === newOrUpdatedRule.id ? newOrUpdatedRule : rule
        );
      } else {
        return [...prevRules, newOrUpdatedRule];
      }
    });

    setIsDialogOpen(false);
    setEditingRule(null);
    setFormRule(getInitialNewRule());
    toast.success(
      editingRule ? "Rule updated successfully!" : "New rule created!"
    );
  }, [formRule, editingRule]);

  const handleToggleEnable = useCallback((id: string, isEnabled: boolean) => {
    setRules((prevRules) =>
      prevRules.map((rule) =>
        rule.id === id ? { ...rule, isEnabled: isEnabled } : rule
      )
    );
    toast.info(isEnabled ? "Rule activated." : "Rule deactivated.");
  }, []);

  const handleConvertNlToRule = useCallback(async () => {
    if (!nlPrompt.trim()) {
      toast.error("Please enter a natural language rule.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/generate-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nlPrompt }),
      });

      const result: GeminiRuleConversionResponse = await response.json();

      if (response.ok && result.success && result.suggestedRule) {
        const newRule: NaturalLanguageRule = {
          id: generateUniqueId(),
          type: "naturalLanguage",
          description: nlPrompt,
          isEnabled: true,
          source: "ai",
          originalPrompt: nlPrompt,
          suggestedStructuredRule: result.suggestedRule,
          aiConfidence: result.confidence,
        };
        setRules((prevRules) => [...prevRules, newRule]);
        setNlPrompt("");
        toast.success(result.message || "Rule successfully converted from AI!");
      } else {
        const errorMessage =
          result.message || "Failed to convert rule from natural language.";
        toast.error("AI Conversion Failed: " + errorMessage);
      }
    } catch (error: any) {
      console.error("Error calling generate-rule API:", error);
      const errorMessage = `An unexpected error occurred: ${
        error.message || "Please try again."
      }`;
      toast.error("API Error: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [nlPrompt]);

  const handleRemoveRule = useCallback((id: string) => {
    setRules((prevRules) => prevRules.filter((rule) => rule.id !== id));
    toast.info("Rule removed.");
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return; // Dropped outside a droppable area
      }

      const reorderedVisibleRules = Array.from(visibleRules); // Make a mutable copy
      const [movedRule] = reorderedVisibleRules.splice(result.source.index, 1);
      reorderedVisibleRules.splice(result.destination.index, 0, movedRule);

      const newPrecedenceRule: PrecedenceOverrideRule = {
        id: currentPrecedenceRule?.id || generateUniqueId(),
        type: "precedenceOverride",
        description:
          "Defines the custom execution order of rules via drag-and-drop.",
        isEnabled: true,
        source: "manual",
        ruleIds: reorderedVisibleRules.map((rule) => rule.id),
      };

      setRules([...reorderedVisibleRules, newPrecedenceRule]);

      toast.success("Rule order updated successfully!");
    },
    [visibleRules, currentPrecedenceRule]
  );

  const exportRulesToJson = useCallback(() => {
    if (rules.length === 0) {
      toast.error("No rules to export.");
      return;
    }

    const jsonString = JSON.stringify(rules, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8;",
    });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "rules.json");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Rules exported successfully as rules.json!");
    } else {
      toast.error(`Your browser does not support automatic JSON download.`);
    }
  }, [rules]);

  const renderRuleSpecificFields = () => {
    switch (formRule.type) {
      case "coRun":
        return (
          <div className="space-y-2">
            <Label htmlFor="taskIds">Task IDs (comma-separated)</Label>
            <Input
              id="taskIds"
              value={(formRule as CoRunRule).taskIds?.join(",") || ""}
              onChange={(e) =>
                handleFormChange(
                  "taskIds",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s !== "")
                )
              }
              placeholder="e.g., T1,T2,T3"
            />
          </div>
        );
      case "slotRestriction":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupType">Group Type</Label>
              <Select
                value={(formRule as SlotRestrictionRule).groupType || ""}
                onValueChange={(value) => handleFormChange("groupType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clientGroup">Client Group</SelectItem>
                  <SelectItem value="workerGroup">Worker Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={(formRule as SlotRestrictionRule).groupName || ""}
                onChange={(e) => handleFormChange("groupName", e.target.value)}
                placeholder="e.g., VIP Clients"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="minCommonSlots">Minimum Common Slots</Label>
              <Input
                id="minCommonSlots"
                type="number"
                value={
                  typeof (formRule as SlotRestrictionRule).minCommonSlots ===
                  "number"
                    ? (formRule as SlotRestrictionRule).minCommonSlots
                    : ""
                }
                onChange={(e) =>
                  handleFormChange(
                    "minCommonSlots",
                    parseInt(e.target.value) || 0
                  )
                }
                placeholder="e.g., 5"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="targetPhases">
                Target Phases (comma-separated numbers)
              </Label>
              <Input
                id="targetPhases"
                value={
                  (formRule as SlotRestrictionRule).targetPhases?.join(",") ||
                  ""
                }
                onChange={(e) =>
                  handleFormChange(
                    "targetPhases",
                    e.target.value
                      .split(",")
                      .map((s) => parseInt(s.trim()))
                      .filter((n) => !isNaN(n))
                  )
                }
                placeholder="e.g., 1,3,5"
              />
            </div>
          </div>
        );
      case "loadLimit":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workerGroup">Worker Group</Label>
              <Input
                id="workerGroup"
                value={(formRule as LoadLimitRule).workerGroup || ""}
                onChange={(e) =>
                  handleFormChange("workerGroup", e.target.value)
                }
                placeholder="e.g., DevTeam"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLoad">Max Load</Label>
              <Input
                id="maxLoad"
                type="number"
                value={
                  typeof (formRule as LoadLimitRule).maxLoad === "number"
                    ? (formRule as LoadLimitRule).maxLoad
                    : ""
                }
                onChange={(e) =>
                  handleFormChange("maxLoad", parseInt(e.target.value) || 0)
                }
                placeholder="e.g., 10"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="phase">Specific Phase (Optional)</Label>
              <Input
                id="phase"
                type="number"
                value={
                  typeof (formRule as LoadLimitRule).phase === "number"
                    ? (formRule as LoadLimitRule).phase
                    : ""
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  handleFormChange("phase", isNaN(val) ? undefined : val);
                }}
                placeholder="e.g., 3"
              />
            </div>
          </div>
        );
      case "phaseWindow":
        return (
          <div className="space-y-2">
            <Label htmlFor="taskId">Task ID</Label>
            <Input
              id="taskId"
              value={(formRule as PhaseWindowRule).taskId || ""}
              onChange={(e) => handleFormChange("taskId", e.target.value)}
              placeholder="e.g., T5"
            />
            <Label htmlFor="allowedPhases">
              Allowed Phases (comma-separated: numbers or ranges like 1-3)
            </Label>
            <Input
              id="allowedPhases"
              value={
                (formRule as PhaseWindowRule).allowedPhases?.join(",") || ""
              }
              onChange={(e) =>
                handleFormChange(
                  "allowedPhases",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s !== "")
                )
              }
              placeholder="e.g., 1,2,3-5"
            />
          </div>
        );
      case "patternMatch":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entity">Entity</Label>
              <Select
                value={(formRule as PatternMatchRule).entity || ""}
                onValueChange={(value) => handleFormChange("entity", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clients">Clients</SelectItem>
                  <SelectItem value="workers">Workers</SelectItem>
                  <SelectItem value="tasks">Tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="column">Column</Label>
              <Input
                id="column"
                value={(formRule as PatternMatchRule).column || ""}
                onChange={(e) => handleFormChange("column", e.target.value)}
                placeholder="e.g., clientName"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="regex">Regex Pattern</Label>
              <Input
                id="regex"
                value={(formRule as PatternMatchRule).regex || ""}
                onChange={(e) => handleFormChange("regex", e.target.value)}
                placeholder="e.g., ^VIP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select
                value={(formRule as PatternMatchRule).action || ""}
                onValueChange={(value) => handleFormChange("action", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag">Flag</SelectItem>
                  <SelectItem value="transform">Transform</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(formRule as PatternMatchRule).action === "transform" && (
              <div className="space-y-2">
                <Label htmlFor="transformTo">Transform To</Label>
                <Input
                  id="transformTo"
                  value={
                    (formRule as PatternMatchRule).actionDetails?.transformTo ||
                    ""
                  }
                  onChange={(e) =>
                    handleFormChange("actionDetails", {
                      ...formRule.actionDetails,
                      transformTo: e.target.value,
                    })
                  }
                  placeholder="e.g., VIP Client"
                />
              </div>
            )}
            {(formRule as PatternMatchRule).action === "flag" && (
              <div className="space-y-2">
                <Label htmlFor="message">Flag Message</Label>
                <Input
                  id="message"
                  value={
                    (formRule as PatternMatchRule).actionDetails?.message || ""
                  }
                  onChange={(e) =>
                    handleFormChange("actionDetails", {
                      ...formRule.actionDetails,
                      message: e.target.value,
                    })
                  }
                  placeholder="e.g., Potential corporate client"
                />
              </div>
            )}
          </div>
        );
      case "precedenceOverride":
        return (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm flex items-center">
              <FiInfo className="mr-1 text-primary" /> This rule is managed in
              the 'Rule Prioritization (Drag & Drop)' section below.
            </p>
          </div>
        );
      default:
        return (
          <p className="text-muted-foreground text-sm">
            Select a rule type to configure its specific properties.
          </p>
        );
    }
  };

  return (
    <Card className="p-6 md:p-8">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold text-foreground">
          Configure Business Rules
        </CardTitle>
        <CardDescription className="text-muted-foreground mt-2">
          Define how your data should be processed and resources allocated, or
          let AI assist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Natural Language Rule Input Section */}
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <FiZap className="mr-2 text-primary" /> AI Rule Converter
          </h3>
          <p className="text-sm text-muted-foreground">
            Type your rule in plain English and let AI convert it to a
            structured format.
          </p>
          <Textarea
            placeholder="e.g., Make sure tasks T1 and T2 are always done by the same worker."
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            className="min-h-[80px]"
            disabled={isLoading}
          />
          <Button onClick={handleConvertNlToRule} disabled={isLoading}>
            {isLoading ? (
              <FiLoader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FiZap className="mr-2 h-4 w-4" />
            )}
            Convert to Rule
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <div className="text-center">
              <Button
                onClick={() => {
                  setEditingRule(null);
                  setIsDialogOpen(true);
                }}
                className="mx-auto"
              >
                <FiPlusCircle className="mr-2 h-4 w-4" /> Create New Rule
                Manually
              </Button>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? "Edit Rule" : "Create New Rule"}
              </DialogTitle>
              <DialogDescription>
                {editingRule
                  ? "Modify the properties of this rule."
                  : "Define a new business rule manually."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ruleType">Rule Type</Label>
                <Select
                  value={formRule.type}
                  onValueChange={(value) => handleFormChange("type", value)}
                  disabled={
                    !!editingRule && editingRule.type === "naturalLanguage"
                  }
                >
                  <SelectTrigger id="ruleType">
                    <SelectValue placeholder="Select a rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingRule && editingRule.type === "naturalLanguage" && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center">
                    <FiInfo className="mr-1 text-primary" /> Type cannot be
                    changed for AI-generated rules.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formRule.description}
                  onChange={(e) =>
                    handleFormChange("description", e.target.value)
                  }
                  placeholder="A short description of this rule."
                  className="min-h-[60px]"
                />
              </div>

              {renderRuleSpecificFields()}

              <div className="flex items-center space-x-2 mt-4">
                <Checkbox
                  id="isEnabled"
                  checked={formRule.isEnabled}
                  onCheckedChange={(checked) =>
                    handleFormChange("isEnabled", checked)
                  }
                />
                <Label htmlFor="isEnabled">Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRule}>
                {editingRule ? "Save Changes" : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
          <h3 className="text-xl font-semibold text-foreground flex items-center mb-4">
            <FiCheckCircle className="mr-2 text-primary" /> Rule Prioritization
            (Drag & Drop)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop rules below to define their execution order. Rules are
            applied from top to bottom.
          </p>

          {visibleRules.length === 0 ? (
            <p className="text-muted-foreground text-center p-4 border border-border rounded-lg">
              Create some rules first to reorder them here!
            </p>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="ruleList">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3 p-2 bg-card rounded-md border border-border"
                  >
                    {visibleRules.map((rule, index) => (
                      <Draggable
                        key={rule.id}
                        draggableId={rule.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps} // Important for drag handle
                            className={`p-3 bg-secondary rounded-md border border-border flex items-center justify-between text-foreground
                                        ${
                                          snapshot.isDragging
                                            ? "shadow-lg bg-primary/20 scale-102"
                                            : ""
                                        } transition-all`}
                          >
                            <span className="font-medium text-sm flex-1 truncate">
                              {index + 1}. {rule.description}
                              <code className="font-mono text-xs ml-2 text-muted-foreground/80">
                                (ID: {rule.id})
                              </code>
                            </span>
                            <div className="flex items-center space-x-2">
                              {rule.isEnabled ? (
                                <span className="text-emerald-500 text-xs ml-1 flex items-center font-medium">
                                  <FiCheckCircle className="inline-block h-3 w-3 mr-1" />{" "}
                                  Active
                                </span>
                              ) : (
                                <span className="text-rose-500 text-xs ml-1 flex items-center font-medium">
                                  <FiXCircle className="inline-block h-3 w-3 mr-1" />{" "}
                                  Inactive
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-1"
                                onClick={() =>
                                  copyToClipboard(rule.id, "Rule ID copied!")
                                }
                                title="Copy Rule ID"
                              >
                                <FiCopy className="h-3 w-3 text-muted-foreground" />
                                <span className="sr-only">Copy Rule ID</span>
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {currentPrecedenceRule &&
            currentPrecedenceRule.ruleIds.length > 0 && (
              <div className="mt-3 p-3 bg-card/50 border border-border rounded-md text-sm text-foreground">
                <p className="font-medium text-primary-foreground/80">
                  Current Active Order (for export):
                </p>
                <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {currentPrecedenceRule.ruleIds.join(" → ")}
                </pre>
              </div>
            )}
        </div>

        <div className="text-center">
          <Button onClick={exportRulesToJson}>
            <FiDownload className="mr-2 h-4 w-4" /> Export All Rules (.json)
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground flex items-center">
            <FiPlusCircle className="mr-2 text-primary" /> All Configured Rules
            ({visibleRules.length})
          </h3>
          {visibleRules.length === 0 ? (
            <p className="text-muted-foreground text-center p-4 border border-border rounded-lg">
              No rules configured yet. Start by typing a natural language rule
              or create one manually!
            </p>
          ) : (
            <div className="space-y-4">
              {visibleRules.map((rule, index) => (
                <Card
                  key={rule.id}
                  className="p-4 bg-secondary/20 border border-border"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-foreground text-lg mb-1">
                        {rule.type === "naturalLanguage"
                          ? "AI Generated Rule"
                          : ruleTypeOptions.find(
                              (opt) => opt.value === rule.type
                            )?.label ||
                            rule.type.replace(/([A-Z])/g, " $1").trim()}
                      </h4>
                      <p className="text-muted-foreground text-sm flex items-center">
                        ID:{" "}
                        <code className="font-mono text-xs ml-1 dark:text-white text-black">
                          {rule.id}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-1"
                          onClick={() =>
                            copyToClipboard(rule.id, "Rule ID copied!")
                          }
                          title="Copy Rule ID"
                        >
                          <FiCopy className="h-3 w-3 text-muted-foreground" />
                          <span className="sr-only">Copy Rule ID</span>
                        </Button>
                      </p>
                      <p className="text-muted-foreground text-sm flex items-center mt-1">
                        Status:{" "}
                        {rule.isEnabled ? (
                          <span className="text-primary ml-1 flex items-center font-medium">
                            <FiCheckCircle className="inline-block h-3 w-3 mr-1" />{" "}
                            Active
                          </span>
                        ) : (
                          <span className="text-destructive ml-1 flex items-center font-medium">
                            <FiXCircle className="inline-block h-3 w-3 mr-1" />{" "}
                            Inactive
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleToggleEnable(rule.id, !rule.isEnabled)
                        }
                        title={
                          rule.isEnabled ? "Deactivate Rule" : "Activate Rule"
                        }
                      >
                        {rule.isEnabled ? (
                          <FiToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <FiToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="sr-only">
                          {rule.isEnabled ? "Deactivate rule" : "Activate rule"}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingRule(rule);
                          setIsDialogOpen(true);
                        }}
                        title="Edit Rule"
                      >
                        <FiEdit3 className="h-4 w-4" />
                        <span className="sr-only">Edit rule</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveRule(rule.id)}
                        title="Remove Rule"
                      >
                        <FiTrash2 className="h-4 w-4" />
                        <span className="sr-only">Remove rule</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-foreground text-base mb-2">
                    {rule.description}
                  </p>
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRuleExpansion(rule.id)}
                      className="text-primary flex items-center"
                    >
                      {expandedRules.has(rule.id) ? (
                        <>
                          <FiChevronUp className="mr-1 h-4 w-4" /> Collapse
                          Details
                        </>
                      ) : (
                        <>
                          <FiChevronDown className="mr-1 h-4 w-4" /> View
                          Details
                        </>
                      )}
                    </Button>
                    {expandedRules.has(rule.id) && (
                      <div className="p-3 bg-card/50 border border-border rounded-md text-sm text-foreground mt-2">
                        <p className="font-medium text-primary-foreground/80 mb-2">
                          Structured Rule Details:
                        </p>
                        <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {JSON.stringify(
                            rule.type === "naturalLanguage"
                              ? (rule as NaturalLanguageRule)
                                  .suggestedStructuredRule
                              : rule,
                            null,
                            2
                          )}
                        </pre>
                        {rule.type === "naturalLanguage" &&
                          (rule as NaturalLanguageRule).aiConfidence && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Confidence:{" "}
                              {(
                                (rule as NaturalLanguageRule).aiConfidence! *
                                100
                              ).toFixed(0)}
                              %
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RuleConfigurator;
