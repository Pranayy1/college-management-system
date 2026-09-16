-- Altering rollnumber column type from INT to VARCHAR(30) in students, marks, rollgenerator, and attandance tables.

BEGIN;

ALTER TABLE marks DROP CONSTRAINT fk_marks_student;

ALTER TABLE students
  ALTER COLUMN rollnumber TYPE VARCHAR(30)
  USING rollnumber::text;

ALTER TABLE marks
  ALTER COLUMN rollnumber TYPE VARCHAR(30)
  USING rollnumber::text;

ALTER TABLE rollgenerator
  ALTER COLUMN rollnumber TYPE VARCHAR(30)
  USING rollnumber::text;

ALTER TABLE attandance
  ALTER COLUMN rollnumber TYPE VARCHAR(30)
  USING rollnumber::text;

ALTER TABLE marks
  ADD CONSTRAINT fk_marks_student
  FOREIGN KEY (rollnumber)
  REFERENCES students (rollnumber)
  ON DELETE CASCADE;

COMMIT;