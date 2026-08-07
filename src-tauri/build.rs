// Vortex-Optimizer modifica el Registro, servicios y BCD de todo el sistema (HKLM, arranque, energía), así
// que necesita privilegios de administrador para casi cualquier acción real. En vez de pedir
// elevación tweak por tweak (lo que además obliga a relanzar procesos elevados uno por uno, ver
// `crate::powershell::run_elevated`/`run_elevated_exe`), el ejecutable pide `requireAdministrator`
// en su manifiesto de Windows: el propio SO exige UAC una sola vez, al abrir la app, de forma
// consistente en cada lanzamiento (doble clic, acceso directo, `tauri dev`, etc. — el manifiesto se
// embebe en cualquier build de este crate, no sólo en el instalador).
//
// Las llamadas a `run_elevated`/`run_elevated_exe` se mantienen: al estar el proceso ya elevado,
// `Start-Process -Verb RunAs` no vuelve a mostrar UAC (el token ya es de administrador), así que
// siguen funcionando sin cambios y sin prompts duplicados — quedan como red de seguridad por si
// alguna vez se lanza el binario sin pasar por este manifiesto (por ejemplo, copiado a mano fuera
// del instalador).
// Manifiesto mínimo y bien probado (es, literalmente, el ejemplo canónico de Microsoft para pedir
// elevación por manifiesto). El primer intento agregaba además un bloque `<compatibility>` con los
// GUID de `supportedOS` para Windows 7–11, pero uno de esos GUID estaba mal tipeado; eso rompe el
// binding de SxS al arrancar ("la configuración en paralelo no es correcta"). Como ese bloque no es
// necesario para el único objetivo real (`requireAdministrator`), se saca en vez de arriesgar otro
// GUID incorrecto — el `Common-Controls` de abajo es la única dependencia real que hace falta (la
// pide el propio `tauri-build` para los diálogos nativos).
const ADMIN_MANIFEST: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
</assembly>
"#;

fn main() {
    let attributes = tauri_build::Attributes::new().windows_attributes(
        tauri_build::WindowsAttributes::new().app_manifest(ADMIN_MANIFEST),
    );
    tauri_build::try_build(attributes).expect("no se pudo generar el manifiesto de Windows");
}
