"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { Textarea } from "@/components/ui/field";
import { IMPROVE_ACTIONS, type ImproveAction } from "@/lib/ai/improve-actions";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ClipboardList,
  Feather,
  Hammer,
  Lightbulb,
  MessageSquarePlus,
  Microscope,
  Sparkles,
  Wand2,
} from "lucide-react";
import * as React from "react";

const ICONS: Record<ImproveAction, React.ReactNode> = {
  simplify: <Feather />,
  detail: <Microscope />,
  examples: <Lightbulb />,
  activity: <ClipboardList />,
  professional: <Wand2 />,
  shorten: <ArrowDownWideNarrow />,
  expand: <ArrowUpWideNarrow />,
  practical: <Hammer />,
};

const ORDER: ImproveAction[] = [
  "simplify",
  "detail",
  "examples",
  "activity",
  "practical",
  "professional",
  "shorten",
  "expand",
];

export function ImproveMenu({
  onSelect,
  disabled,
  label = "Improve with AI",
}: {
  onSelect: (action: ImproveAction | string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [customOpen, setCustomOpen] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");

  return (
    <>
      <Menu
        width={228}
        trigger={
          <Button variant="subtle" size="sm" disabled={disabled}>
            <Sparkles />
            {label}
          </Button>
        }
      >
        <MenuLabel>Rewrite this lesson</MenuLabel>
        {ORDER.map((action) => (
          <MenuItem key={action} icon={ICONS[action]} onSelect={() => onSelect(action)}>
            {IMPROVE_ACTIONS[action].label}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<MessageSquarePlus />} onSelect={() => setCustomOpen(true)}>
          Custom instruction…
        </MenuItem>
      </Menu>

      <Dialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Improve with AI"
        description="Tell the AI exactly how this lesson should change. It rewrites the whole lesson."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={instruction.trim().length < 5}
              onClick={() => {
                onSelect(instruction.trim());
                setCustomOpen(false);
                setInstruction("");
              }}
            >
              <Sparkles />
              Rewrite lesson
            </Button>
          </>
        }
      >
        <Textarea
          autoFocus
          rows={4}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Add a worked example using a real UK VAT return, and cut the history section."
        />
      </Dialog>
    </>
  );
}
