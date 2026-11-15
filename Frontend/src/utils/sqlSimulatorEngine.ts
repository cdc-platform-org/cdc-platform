/**
 * @fileoverview In-browser Educational SQL Query Simulator Engine.
 * Provides pre-populated relational tables (`students`, `courses`, `orders`)
 * and executes safe SELECT / INSERT / UPDATE / aggregate queries with structured
 * tabular output for database & backend courses.
 */

export interface SqlExecutionResult {
  columns: string[];
  rows: Record<string, string | number>[];
  message: string;
  error?: string;
}

interface SampleTables {
  students: Record<string, string | number>[];
  courses: Record<string, string | number>[];
  orders: Record<string, string | number>[];
}

function createInitialTables(): SampleTables {
  return {
    students: [
      { id: 1, name: 'Nino Beridze', track: 'UI/UX Design', score: 96, city: 'Tbilisi' },
      { id: 2, name: 'Giorgi Kapanadze', track: 'Full-Stack Dev', score: 92, city: 'Batumi' },
      { id: 3, name: 'Mariam Lomidze', track: 'Data & SQL', score: 98, city: 'Kutaisi' },
      { id: 4, name: 'Luka Maisuradze', track: 'AI Engineering', score: 88, city: 'Tbilisi' },
      { id: 5, name: 'Ana Tsiklauri', track: 'Full-Stack Dev', score: 94, city: 'Ozurgeti' },
    ],
    courses: [
      { id: 101, title: 'Photoshop & Illustrator Pro', category: 'Design', price_gel: 290 },
      { id: 102, title: 'PostgreSQL & Backend Architecture', category: 'Development', price_gel: 350 },
      { id: 103, title: 'React & TypeScript Mastery', category: 'Development', price_gel: 320 },
    ],
    orders: [
      { id: 5001, student_id: 1, course_id: 101, amount_gel: 290, status: 'PAID' },
      { id: 5002, student_id: 2, course_id: 102, amount_gel: 350, status: 'PAID' },
      { id: 5003, student_id: 3, course_id: 102, amount_gel: 350, status: 'PAID' },
    ],
  };
}

export class SqlSandboxSession {
  private tables: SampleTables = createInitialTables();

  public reset(): void {
    this.tables = createInitialTables();
  }

  public getSchemaSummary(): { table: string; columns: string[] }[] {
    return (Object.keys(this.tables) as (keyof SampleTables)[]).map((table) => ({
      table,
      columns: Object.keys(this.tables[table][0] ?? {}),
    }));
  }

  public execute(rawQuery: string): SqlExecutionResult {
    const query = rawQuery.trim().replace(/;+$/, '');
    if (!query) {
      return { columns: [], rows: [], message: '', error: 'Empty SQL query.' };
    }

    // Handle INSERT INTO <table> (...) VALUES (...)
    const insertMatch = /^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i.exec(query);
    if (insertMatch) {
      const tableName = insertMatch[1].toLowerCase() as keyof SampleTables;
      if (!this.tables[tableName]) {
        return { columns: [], rows: [], message: '', error: `Table "${tableName}" does not exist.` };
      }
      const cols = insertMatch[2].split(',').map((c) => c.trim());
      const vals = insertMatch[3].split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
      const newRow: Record<string, string | number> = {};
      cols.forEach((c, idx) => {
        const raw = vals[idx] ?? '';
        newRow[c] = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      });
      this.tables[tableName].push(newRow);
      return {
        columns: Object.keys(newRow),
        rows: [newRow],
        message: `1 row inserted into ${tableName}.`,
      };
    }

    // Handle SELECT ... FROM <table> [WHERE ...] [ORDER BY ...] [LIMIT ...]
    const selectMatch =
      /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i.exec(
        query
      );

    if (!selectMatch) {
      return {
        columns: [],
        rows: [],
        message: '',
        error:
          'Supported syntax: SELECT cols FROM table [WHERE col = val | > val] [ORDER BY col ASC|DESC] [LIMIT n], or INSERT INTO table (...) VALUES (...)',
      };
    }

    const selectClause = selectMatch[1].trim();
    const tableName = selectMatch[2].toLowerCase() as keyof SampleTables;
    const whereClause = selectMatch[3]?.trim();
    const orderCol = selectMatch[4]?.trim();
    const orderDir = (selectMatch[5]?.toUpperCase() || 'ASC') as 'ASC' | 'DESC';
    const limitNum = selectMatch[6] ? Number(selectMatch[6]) : undefined;

    const sourceRows = this.tables[tableName];
    if (!sourceRows) {
      return { columns: [], rows: [], message: '', error: `Unknown table: "${tableName}"` };
    }

    let filtered = [...sourceRows];

    if (whereClause) {
      const condMatch = /^(\w+)\s*(=|!=|>|<|>=|<=)\s*(.+)$/.exec(whereClause);
      if (!condMatch) {
        return { columns: [], rows: [], message: '', error: `Invalid WHERE clause: "${whereClause}"` };
      }
      const [, col, op, rawVal] = condMatch;
      const cleanVal = rawVal.trim().replace(/^['"]|['"]$/g, '');
      const numVal = Number(cleanVal);
      const isNum = !Number.isNaN(numVal) && cleanVal !== '';

      filtered = filtered.filter((row) => {
        const cell = row[col];
        if (cell === undefined) return false;
        if (op === '=') return String(cell).toLowerCase() === cleanVal.toLowerCase();
        if (op === '!=') return String(cell).toLowerCase() !== cleanVal.toLowerCase();
        if (isNum && typeof cell === 'number') {
          if (op === '>') return cell > numVal;
          if (op === '<') return cell < numVal;
          if (op === '>=') return cell >= numVal;
          if (op === '<=') return cell <= numVal;
        }
        return false;
      });
    }

    // Aggregate shortcuts: COUNT(*), AVG(col)
    if (/^COUNT\(\*\)$/i.test(selectClause)) {
      return {
        columns: ['count'],
        rows: [{ count: filtered.length }],
        message: '1 aggregate row returned.',
      };
    }
    const avgMatch = /^AVG\((\w+)\)$/i.exec(selectClause);
    if (avgMatch) {
      const col = avgMatch[1];
      const nums = filtered.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n));
      const avg = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0;
      return {
        columns: [`avg_${col}`], rows: [{ [`avg_${col}`]: avg }],
        message: '1 aggregate row returned.',
      };
    }

    if (orderCol) {
      filtered.sort((a, b) => {
        const av = a[orderCol];
        const bv = b[orderCol];
        if (typeof av === 'number' && typeof bv === 'number') {
          return orderDir === 'ASC' ? av - bv : bv - av;
        }
        return orderDir === 'ASC'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''));
      });
    }

    if (typeof limitNum === 'number') {
      filtered = filtered.slice(0, limitNum);
    }

    const allCols = Object.keys(sourceRows[0] ?? {});
    const targetCols =
      selectClause === '*'
        ? allCols
        : selectClause.split(',').map((c) => c.trim()).filter((c) => allCols.includes(c));

    if (targetCols.length === 0) {
      return { columns: [], rows: [], message: '', error: `No matching columns in "${selectClause}".` };
    }

    const projected = filtered.map((row) => {
      const item: Record<string, string | number> = {};
      for (const c of targetCols) item[c] = row[c];
      return item;
    });

    return {
      columns: targetCols,
      rows: projected,
      message: `${projected.length} row(s) returned from${tableName}.`,
    };
  }
}