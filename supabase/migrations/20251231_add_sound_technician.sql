-- Add Sound Technician as a labour item in equipment table
-- Rate is $65/hour (stored as hire_rate_per_day since quantity = hours)
INSERT INTO equipment (category, name, hire_rate_per_day, stock_quantity, available, notes)
VALUES ('Labour', 'Sound Technician', 65, 99, true, 'Hourly rate for sound technician services')
ON CONFLICT (name) DO UPDATE SET
  category = 'Labour',
  hire_rate_per_day = 65,
  available = true,
  notes = 'Hourly rate for sound technician services';
