# Life OS MVP

> Исторический документ первоначального MVP. Текущие возможности Orvim: [README](../README.md); действующая архитектура: [ARCHITECTURE.md](ARCHITECTURE.md).

## Purpose

Reduce the number of things a person must keep in their head. Capture loose ends,
give meaningful work a next step, notice progress beyond tasks, and make space
for reflection. The product does not grade a person's life.

## Navigation and behavior

| Destination | Behavior                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Now         | Local date and greeting, up to three main actions, today's check-in, up to three active projects, latest Win    |
| Inbox       | Fast capture with Enter; newest captures first; processed and unprocessed views; restore and confirmed deletion |
| Projects    | Active by default; create/edit; Life Area; four statuses; next action; target/review dates; archive/restore     |
| Life        | Nine Areas with icon/accent, active projects, and recent Win counts                                             |
| Wins        | Manual moments, notes, optional Area/project, local date, newest-first monthly groups and monthly count         |
| Review      | Start/resume weekly reflection, autosave, complete, revisit history                                             |
| Someday     | Paused projects and ideas; activate when ready                                                                  |

Desktop has a sidebar. At narrow widths, the bottom navigation contains Now,
Inbox, Projects, Wins, and More. More contains Life, Review, and Someday. All
destinations remain reachable at 320px.

## Main actions

Actions are tasks, with optional project, Area, notes, scheduled date, and due
date. Now shows at most three open actions whose project is active (or absent)
and which are unscheduled, scheduled on/before today, or already due.
They sort by earliest due date, scheduled date, then creation time.
Future scheduled actions stay in All actions. Completed/cancelled actions can
be reopened. All actions remains available even when Now has nothing to show.

A project's next action can prefill a task. The task and the project's description
of its next step remain independent. Completing either a task or a project does
not automatically manufacture a Win.

## Wins

A Win can be an honest conversation, meaningful rest, a step forward, or anything
the person values. There are no points, streak rewards, badges, or confetti.
The UI uses quiet emphasis and a timeline rather than a score.

## Daily check-in

The check-in is optional, with independently optional mood, energy, and stress
on a 1–10 scale. Sleep is entered as whole minutes from 0 to 1440, plus an optional
note. At least one value or a note is needed to save. Saving again on the same
local date updates the same row and keeps its original identity/creation time.

## Weekly review

The sections are Inbox, Mind, Body, Work, Money, Relationships, Projects, Open
Loops, Wins, and Next Week. Each has reflection text and previous/next controls;
section buttons also allow direct navigation.

Drafts autosave after a short pause. Save for later, app navigation, and native
window close also flush changes. Save errors remain visible and prevent leaving
the unfinished review until the save succeeds. Abrupt process termination or
power loss before a pending save is different from a normal window close.

Next Week allows zero to three focuses, typed directly or chosen from active
project titles. Focuses are saved in the review, not automatically turned into
tasks. Only one unfinished weekly review is allowed at a time. Completed reviews
are read-only and remain available in history.

## Scope boundaries

No cloud, account, AI, external backend, automatic life judgments, or hidden
sample data. Android runs the same product through the
[Android foundation](ANDROID.md). Richer task planning, editable Areas,
export/backup UI, and integrations are later milestones.
