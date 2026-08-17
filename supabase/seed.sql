-- Optional starter data. Change these before use.
insert into public.employees(employee_no, full_name, department)
values
('EMP-0001', 'Juan Dela Cruz', 'Sample Office'),
('EMP-0002', 'Maria Santos', 'Sample Office')
on conflict (employee_no) do nothing;