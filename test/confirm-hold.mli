(** ConfirmHold — cavity under HoldEngine.
    Confirm a previously created inventory hold into a booking. *)

type hold_id = string
type payment_ref = string
type iso8601 = string
type money_cents = int
type currency = string
type guest_id = string
type room_type_id = string
type property_id = string

type confirm_cmd = {
  hold_id : hold_id;
  payment_ref : payment_ref;
  confirmed_at : iso8601;
  actor : string;
}

type line = {
  room_type_id : room_type_id;
  nights : int;
  unit_cents : money_cents;
  tax_cents : money_cents;
}

type confirmation = {
  booking_id : string;
  hold_id : hold_id;
  property_id : property_id;
  guest_id : guest_id;
  currency : currency;
  total_cents : money_cents;
  lines : line list;
  confirmed_at : iso8601;
}

type confirm_error =
  | Hold_not_found of hold_id
  | Hold_expired of hold_id * iso8601
  | Hold_already_confirmed of string
  | Hold_cancelled of hold_id
  | Payment_mismatch of payment_ref * payment_ref
  | Payment_not_captured of payment_ref
  | Inventory_lost of room_type_id * iso8601
  | Price_drift of money_cents * money_cents
  | Guest_blocked of guest_id
  | Property_closed of property_id * iso8601
  | Actor_unauthorized of string
  | Concurrent_confirm of hold_id
  | Malformed of string

val confirm : confirm_cmd -> (confirmation, confirm_error) result
(** Pure. No I/O. Callers supply already-loaded snapshots via the
    surrounding HoldEngine; this cavity only decides. *)
