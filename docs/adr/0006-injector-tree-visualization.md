# ADR 0006: Visualize an Injector tree with contained Registrations

## Status

Accepted

## Context

The first `DebuggerPanel` renders Injectors as nested document-flow cards and
lists each dependency as a textual arrow underneath its Registration. Although
the data is present, this does not behave like a spatial dependency graph.

An earlier design direction explored selecting a Registration as the graph root
and rendering only its outgoing dependency closure. That interpretation was
rejected: it removed the Injector hierarchy from the primary visual model.

The intended visualization has two simultaneous structural levels:

1. Injector parent/child relationships form the outer tree.
2. Registrations bound on an Injector are graph elements contained within that
   Injector's visual boundary.

Dependency resolution remains visible through edges between Registrations,
including edges that cross Injector boundaries.

## Decision

Choose an Injector as the visualization root. Render the relevant Injector
parent/child hierarchy as a spatial tree. Treat every Injector as a compound
container and place its own Registrations inside that container.

Parent/child Injector relationships are hierarchy connections between compound
containers. Dependency Edges are separate connections between contained
Registrations and land on the Registration(s) selected by runtime resolution.

Do not replace this model with a Registration-rooted dependency closure, a flat
list of registrations, or Injector identity represented only by node badges.

Only Injectors with no parent are selectable roots. A switch in the top toolbar
is the sole control that changes the active root, and it lists only those root
Injectors. Selecting one renders that root and its complete descendant tree.

Every Injector in the displayed tree can be centered in the viewport. Centering
changes only pan/zoom position: it does not promote that Injector to a root,
hide the rest of the tree, or alter the value of the root switch.

Expose centering as an explicit control in each Injector header. Activating it
centers/fits that Injector container without changing root, Registration
selection, or visibility state. Do not bind centering to a generic header click
or undiscoverable double-click gesture.

Use a compound-graph layout for Registrations inside Injector containers. The
layout engine positions Registration nodes according to dependency connectivity
and routes both same-Injector and cross-Injector Dependency Edges. Injector
boundaries grow to contain their laid-out Registrations. Do not place
Registrations in a fixed grid, registration-order list, or document-flow stack.

Within each Injector, add an Identifier Group boundary around all Registrations
for the same Identifier. Each Registration remains an independent compact node
inside that group; do not merge Providers into one node or scatter
same-Identifier Registrations as unrelated cards. The visual containment model
is therefore Injector → Identifier Group → Registration.

Dependency Edges connect source Registrations directly to the concrete target
Registrations selected by resolution. Identifier Group boundaries do not act as
edge endpoints. A `Many` dependency fans out to each selected Registration in
the target group.

The right-hand details panel supports two selectable entity kinds: Injector and
Registration. Selecting an Injector header shows hierarchy, discovery metadata,
and Registration counts. Selecting a Registration shows Provider/status data
and resolution relationships. Identifier Groups remain organizational
boundaries without a separate details selection model. The Injector's explicit
center control remains distinct from selecting it.

Search is scoped to the active root tree and matches Injectors, Identifiers, and
Providers. Choosing a result centers and selects the corresponding visible
entity without changing the active root. Cross-tree navigation remains the sole
responsibility of the root-only toolbar switch; the normal number of roots is
expected to be small.

Lay out the outer Injector tree from top to bottom. Place the active root at the
top, its child Injectors on the next level, and siblings across the horizontal
axis. Registration compound layout and cross-Injector Dependency Edge routing
operate within this outer directional constraint.

Render parent and child Injectors as separate compound nodes connected by tree
edges. Do not geometrically nest a child Injector inside its parent's boundary.
Only Identifier Groups and their Registrations are contained within an Injector
node.

Use distinct visual grammars for the two edge kinds. Injector parent/child
connectors are thicker neutral structural lines without arrowheads. Dependency
Edges are thinner directed lines with arrowheads, shown at low contrast by
default and emphasized during Registration selection/highlighting. Do not rely
on color alone to distinguish the relationship types.

Give the outer Injector tree absolute layout priority. Keep root depth and
sibling placement stable and predictable even when that makes cross-Injector
Dependency Edges longer or requires them to route around containers. Dependency
connectivity may influence Registration placement inside an Injector, but must
not pull Injector containers out of their tree structure.

Give each Injector two independent visibility controls. Collapsing contents
hides only Registrations owned by that Injector while keeping its container and
child Injectors visible. Collapsing the subtree hides all descendant Injectors
while keeping the selected Injector itself visible. These states are distinct
and must not be represented by one ambiguous collapse action.

When a root is selected from the toolbar switch, initially expand every
Injector, every Injector's Registration contents, and the complete descendant
tree. Do not persist collapse state between root switches or sessions in this
version; collapse state is temporary view state only.

Keep all Dependency Edges present at low visual contrast by default. Injector
parent/child connectors remain visually clear as the primary structure. When a
Registration is selected, emphasize its relevant dependency paths and further
de-emphasize unrelated Dependency Edges instead of hiding the network entirely.

Selecting a Registration highlights its complete transitive outgoing dependency
closure: every visible Registration it depends on and the resolution-aware
paths to those targets. Also highlight only the first level of incoming
dependencies (Registrations that directly depend on the selection). Do not
recursively traverse incoming dependencies.

When Registration contents or an Injector subtree is collapsed, aggregate
Dependency Edges that cross the visible/hidden boundary onto the visible
Injector container. Show incoming/outgoing bundles with counts rather than
hiding those dependencies or leaving individual dangling edges. Expanding the
contents/subtree restores the concrete Registration-to-Registration edges.

## Confirmed visual semantics

- A Registration is rendered once within the Injector that owns it.
- A compact Registration card uses the Identifier as its primary label and the
  Provider/provider kind as supporting information.
- `@Many()` may connect one dependency to multiple Registration targets.
- An edge states the requested Identifier and compact lookup/quantity modifiers.
- Resolution outcomes without a target Registration terminate as labeled edges
  rather than fake Registration nodes.
- Injector identity uses both text and stable color; color is never the only
  identity signal.
- The canvas supports pan, zoom, and fit-to-view controls.
- Selecting a Registration opens a collapsible, resizable right-hand details
  panel.
- The visualization does not add circular-dependency diagnostics.

## Expected consequences

- The graph renderer/layout engine must support compound or grouped nodes.
- Multiple unrelated Injector trees are navigated one at a time through the
  root-only toolbar switch rather than rendered as one forest.
- Layout must coordinate an outer Injector tree with inner Registration layout.
- Cross-Injector Dependency Edges must route across compound boundaries without
  being confused with Injector parent/child connections.
- The existing graph projection remains useful because it already models
  clusters, Registrations, hierarchy IDs, and resolution-aware edges.

## Interaction outline

```text
Root: AppInjector v    Search current tree...    Refresh    -  +  Fit

                 +-----------------------------------------+
                 | AppInjector                  [Center]   |
                 | [hide contents] [hide subtree]          |
                 |                                         |
                 | + ILogger -----------------------------+ |
                 | | [ConsoleLogger]  [FileLogger]         | |
                 | +---------------------------------------+ |
                 | + IStorage ----------------------------+ |
                 | | [IndexedDBStorage]                    | |
                 | +---------------------------------------+ |
                 +-----------------------------------------+
                           |                 |
                  structural connector      |
                           |                 |
          +----------------+-----------------+----------------+
          |                                                   |
 +------------------------------+              +------------------------------+
 | EditorInjector      [Center] |              | SheetInjector       [Center] |
 |                              |              |                              |
 | + ICommandService ---------+ |              | + IFormulaService ---------+ |
 | | [CommandService]         | |              | | [FormulaService]         | |
 | +--------------------------+ |              | +--------------------------+ |
 +------------------------------+              +------------------------------+
            . . . . . . . . . . . . . . . . . . . . . . . .>
                   low-contrast directed dependency edge
```

The two child Injectors are separate sibling containers; neither is nested
inside `AppInjector`. Registration nodes are nested only inside their Identifier
Group, which is nested inside the owning Injector.

## Acceptance notes

- The root switch lists only Injectors whose parent is absent and displays one
  complete tree at a time.
- Switching roots initially expands all Injector subtrees and Registration
  contents; collapse state is not persisted.
- Every Injector is an independent compound node in a top-down tree and exposes
  an explicit viewport-center action.
- Identifier Groups contain independent Registration nodes; resolution-aware
  Dependency Edges land on concrete Registration targets.
- Injector structural connectors stay visually dominant and never use
  dependency arrowheads.
- Dependency Edges remain visible at low contrast. Selecting a Registration
  highlights its transitive outgoing closure plus direct incoming dependencies.
- Collapsed contents/subtrees aggregate crossing dependency edges at the visible
  Injector boundary with incoming/outgoing counts.
- Search locates and selects Injectors or Registrations only in the active tree.
- The details panel supports Injector and Registration selections, but not an
  Identifier Group selection mode.
- The outer Injector tree remains stable even when dependency-edge routing would
  be shorter under a different container placement.
