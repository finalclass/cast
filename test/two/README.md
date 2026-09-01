# Two cavities, one shared die

Hold.stamp is shared. Confirm and Cancel pour separately, then compile against `hold.mli` + their own `.mli`.

Die change measured: add `note : string` to `stamp`. Both cavities re-pour in parallel.

See root README for the method. Numbers from 2026-09-01:

- First seal: confirm 2/5 green; cancel 0/5 until spec said “copy types from the mli”; then cancel 5/5 in 2.0 s.
- After `stamp.note`: both cavities 10 HTTP in **2.9 s** wall. Cancel 5/5. Confirm 0/10 until spec forbade copying `val`; then 4/5 in **5.7 s**.
- Old confirm body still compiled against the new die (extra field unused) but failed `empty-note`.
