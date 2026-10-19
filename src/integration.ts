import type {
  ChangeSet,
  DismissedProposal,
  PipelineMode,
  ProposalGroup,
  RuleDiagnostic,
  RuntimeRule,
  TextChange,
  TextSegment,
} from "./model.ts";
import { runPipeline } from "./pipeline.ts";

/** Integration-owned text node participating in one logical text run. */
export interface TextNodeInput extends TextSegment {
  readonly id: string;
}

/** Replacement value for one input node; tree structure remains untouched. */
export interface TextNodeOutput {
  readonly id: string;
  readonly value: string;
  readonly protected?: boolean;
}

export interface TextNodePipelineOptions {
  readonly locale: string;
  /** Integrations must choose an explicit pass instead of relying on defaults. */
  readonly mode: PipelineMode;
  /** Proposals the host declined; see `PipelineOptions.dismissed`. */
  readonly dismissed?: readonly DismissedProposal[];
}

export interface TextNodePipelineResult extends ChangeSet {
  readonly value: string;
  readonly nodes: readonly TextNodeOutput[];
  readonly changes: readonly TextChange[];
  readonly groups: readonly ProposalGroup[];
  readonly diagnostics: readonly RuleDiagnostic[];
  readonly appliedRuleIds: readonly string[];
}

/**
 * Runs the core on one integration-defined logical text run.
 *
 * Internal classifier fragments are folded back into their source nodes. The
 * function never creates, removes, reorders, or merges integration nodes.
 */
export function runTextNodePipeline(
  nodes: readonly TextNodeInput[],
  runtimeRules: readonly RuntimeRule[],
  options: TextNodePipelineOptions,
): TextNodePipelineResult {
  const result = runPipeline(nodes, runtimeRules, options);
  const fragments = new Map<string, string[]>();
  for (const node of nodes) fragments.set(node.id, []);

  for (const segment of result.segments) {
    if (segment.id === undefined || !fragments.has(segment.id)) {
      throw new Error("Pipeline returned a segment without a source node ID");
    }
    fragments.get(segment.id)?.push(segment.value);
  }

  const output = nodes.map((node): TextNodeOutput => {
    const values = fragments.get(node.id);
    if (values === undefined || values.length === 0) {
      throw new Error(`Pipeline lost source node: ${node.id}`);
    }
    return {
      id: node.id,
      value: values.join(""),
      ...(node.protected === undefined ? {} : { protected: node.protected }),
    };
  });

  return {
    value: result.value,
    nodes: output,
    changes: result.changes,
    groups: result.groups,
    diagnostics: result.diagnostics,
    appliedRuleIds: result.appliedRuleIds,
  };
}
