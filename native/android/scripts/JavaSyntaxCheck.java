import javax.tools.*;
import java.util.*;
import java.io.*;
public class JavaSyntaxCheck {
  public static void main(String[] a) throws Exception {
    JavaCompiler c = ToolProvider.getSystemJavaCompiler();
    if (c == null) { System.out.println("NO COMPILER"); return; }
    DiagnosticCollector<JavaFileObject> d = new DiagnosticCollector<>();
    StandardJavaFileManager fm = c.getStandardFileManager(d, null, null);
    Iterable<? extends JavaFileObject> units = fm.getJavaFileObjectsFromStrings(Arrays.asList(a));
    // Compiles without the Android/Capacitor/libbox jars: only "cannot find symbol" / "package ... does not exist" errors are expected; anything else is a real problem.
    JavaCompiler.CompilationTask t = c.getTask(null, fm, d, Arrays.asList("-proc:none","-Xlint:none"), null, units);
    t.call();
    int n=0;
    for (Diagnostic<? extends JavaFileObject> x : d.getDiagnostics()) { n++; System.out.println(x.getKind()+" "+x.getSource().getName()+":"+x.getLineNumber()+" "+x.getMessage(null)); }
    System.out.println("diagnostics: "+n);
  }
}
