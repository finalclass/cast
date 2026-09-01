(** Shared die. Both cavities compile against this. *)

type hold_id = string
type iso8601 = string
type actor = string

type stamp = {
  at : iso8601;
  actor : actor;
  note : string;
}
