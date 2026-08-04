// src/lib/legal-es.ts
//
// Spanish courtesy translations of the legal documents.
//
// These are convenience translations, not separate agreements. The English
// version governs — that clause is rendered by LegalPage whenever a Spanish
// translation is shown, which is the standard practice for SaaS operating
// bilingually and is far safer than presenting a translated contract as
// authoritative.
//
// A document with no entry here simply renders in English with a short note.
// Partial coverage is honest; a rushed legal translation is not.

export interface LegalSectionEs { title: string; content: string }

export const LEGAL_ES: Record<string, { title: string; sections: LegalSectionEs[] }> = {
  privacy: {
    title: "Política de Privacidad",
    sections: [
      { title: "1. Introducción", content: "FlowSync PM ('nosotros') se compromete a proteger su información personal. Esta Política de Privacidad describe cómo recopilamos, usamos, divulgamos y protegemos la información cuando usted utiliza nuestra plataforma de gestión de proyectos. Esta política aplica a todos los usuarios a nivel mundial y cumple con el GDPR (Unión Europea), la CCPA (California) y los requisitos de privacidad federales de Estados Unidos y de Puerto Rico que resulten aplicables." },
      { title: "2. Información que Recopilamos", content: "Recopilamos: (a) Información de cuenta — nombre, correo electrónico, contraseña (cifrada) y nombre de la organización; (b) Datos del proyecto — tareas, riesgos, documentos y demás contenido que usted introduce; (c) Datos de uso — páginas visitadas, funciones utilizadas, marcas de tiempo, dirección IP y tipo de navegador; (d) Información de pago — procesada por Stripe; no almacenamos números de tarjeta; (e) Datos de comunicación — correos y mensajes de soporte. No recopilamos datos personales sensibles más allá de lo que usted introduzca voluntariamente en los registros del proyecto." },
      { title: "3. Cómo Usamos su Información", content: "Usamos su información para: proveer y mejorar el Servicio; autenticar usuarios y mantener la seguridad; procesar pagos; enviar correos transaccionales (recibos, restablecimiento de contraseña, alertas de seguridad); enviar actualizaciones de producto (puede darse de baja); generar analíticas agregadas y anonimizadas para mejorar la plataforma; brindar soporte al cliente; y cumplir con obligaciones legales." },
      { title: "4. Inteligencia Artificial y Procesamiento de Documentos", content: "Cuando usted utiliza funciones de IA (importación de documentos, generación de reportes, lectura de recibos), el contenido pertinente se transmite a nuestro proveedor de IA para su procesamiento. Ese contenido no se utiliza para entrenar modelos. El procesamiento ocurre únicamente cuando usted lo solicita, y los resultados se le presentan como borradores para su revisión antes de crear cualquier registro." },
      { title: "5. Base Legal del Tratamiento (GDPR)", content: "Tratamos datos personales sobre las siguientes bases: ejecución de un contrato (prestación del Servicio que usted contrató); interés legítimo (seguridad, prevención de fraude, mejora del producto); consentimiento (comunicaciones de mercadeo, que puede retirar en cualquier momento); y cumplimiento de obligaciones legales." },
      { title: "6. Con Quién Compartimos Información", content: "Compartimos información únicamente con proveedores que nos permiten operar: alojamiento e infraestructura, base de datos, procesamiento de pagos, envío de correo, y el proveedor de IA descrito en la sección 4. Cada uno está sujeto a obligaciones contractuales de confidencialidad y seguridad. No vendemos información personal ni la compartimos con anunciantes." },
      { title: "7. Retención de Datos", content: "Conservamos los datos de su cuenta mientras la cuenta esté activa. Tras la cancelación, los datos del espacio de trabajo se conservan por treinta (30) días para permitir su recuperación, y luego se eliminan. Los registros de auditoría y los documentos requeridos por obligaciones legales o fiscales pueden conservarse por períodos mayores según lo exija la ley." },
      { title: "8. Sus Derechos", content: "Según su jurisdicción, usted puede tener derecho a: acceder a los datos personales que tenemos sobre usted; solicitar su corrección; solicitar su eliminación; oponerse a determinados tratamientos o restringirlos; recibir sus datos en un formato portátil; y presentar una reclamación ante una autoridad de protección de datos. Para ejercer cualquiera de estos derechos, escriba a privacy@flowsyncpm.com." },
      { title: "9. Seguridad", content: "Aplicamos cifrado en tránsito y en reposo, control de acceso basado en roles, autenticación mediante proveedores establecidos, y registros de auditoría de las acciones sensibles. Ningún sistema es completamente seguro; le recomendamos usar contraseñas robustas y revisar periódicamente los accesos de su espacio de trabajo." },
      { title: "10. Transferencias Internacionales", content: "Nuestra infraestructura opera en Estados Unidos. Si usted accede al Servicio desde otra jurisdicción, sus datos se transferirán y tratarán en Estados Unidos bajo salvaguardas contractuales adecuadas, incluidas cláusulas contractuales tipo cuando corresponda." },
      { title: "11. Cookies", content: "Utilizamos cookies estrictamente necesarias para la sesión y la seguridad, y cookies analíticas para entender el uso del producto. Puede consultar el detalle en nuestra Política de Cookies. Las cookies analíticas pueden desactivarse sin afectar el funcionamiento del Servicio." },
      { title: "12. Privacidad de Menores", content: "El Servicio no está dirigido a personas menores de dieciocho (18) años y no recopilamos conscientemente su información. Si tenemos conocimiento de que un menor nos ha proporcionado datos personales, los eliminaremos." },
      { title: "13. Cambios a esta Política", content: "Podemos actualizar esta política. Cuando los cambios sean materiales, se lo notificaremos por correo electrónico o mediante un aviso dentro del producto antes de que entren en vigor. La fecha de última actualización aparece al inicio de este documento." },
      { title: "14. Contacto", content: "Para consultas sobre privacidad: privacy@flowsyncpm.com. FLOW SYNC PM, Puerto Rico, Estados Unidos. Registro de Comerciante de Puerto Rico 1552654-0010." },
    ],
  },

  cookies: {
    title: "Política de Cookies",
    sections: [
      { title: "1. Qué son las Cookies", content: "Las cookies son pequeños archivos de texto que un sitio web almacena en su dispositivo. Se utilizan para mantener su sesión iniciada, recordar preferencias y entender cómo se usa el producto." },
      { title: "2. Cookies Estrictamente Necesarias", content: "Estas cookies permiten funciones básicas: mantener su sesión autenticada, proteger contra falsificación de solicitudes, y recordar su selección de idioma y espacio de trabajo. Sin ellas el Servicio no puede funcionar, por lo que no pueden desactivarse." },
      { title: "3. Cookies Analíticas", content: "Utilizamos analítica para entender qué funciones se usan y dónde los usuarios encuentran dificultades. Estos datos se agregan y no se emplean para identificarle individualmente. Puede desactivarlas sin perder funcionalidad." },
      { title: "4. Cookies de Terceros", content: "Nuestro procesador de pagos establece cookies durante el proceso de pago para prevención de fraude. Las páginas públicas de mercadeo pueden incluir un píxel de medición publicitaria; este no está presente en las páginas del producto una vez que usted inicia sesión." },
      { title: "5. Cómo Controlar las Cookies", content: "Puede eliminar o bloquear cookies desde la configuración de su navegador. Bloquear las cookies estrictamente necesarias impedirá iniciar sesión. Los ajustes analíticos pueden cambiarse desde el aviso de cookies del sitio." },
      { title: "6. Contacto", content: "Preguntas sobre cookies: privacy@flowsyncpm.com." },
    ],
  },

  ai: {
    title: "Política de Uso de Inteligencia Artificial",
    sections: [
      { title: "1. Alcance", content: "Esta política describe cómo FlowSync PM utiliza inteligencia artificial y qué puede esperar usted de esas funciones. Aplica a la importación de documentos, el análisis de contenido, la lectura de recibos y facturas, la generación de reportes y las sugerencias automatizadas." },
      { title: "2. La IA Propone, Usted Aprueba", content: "Las funciones de IA producen borradores para su revisión. Ninguna sugerencia crea, modifica o elimina registros de su proyecto sin su aprobación explícita. Los montos, fechas y responsables extraídos de documentos se presentan marcados para verificación." },
      { title: "3. Qué Datos se Procesan", content: "Solo se transmite el contenido necesario para la solicitud que usted inicia: el texto o la imagen del documento seleccionado y el contexto mínimo del proyecto. No se envían datos de otros espacios de trabajo ni de otros clientes." },
      { title: "4. Entrenamiento de Modelos", content: "Su contenido no se utiliza para entrenar modelos de inteligencia artificial, ni por nosotros ni por nuestro proveedor." },
      { title: "5. Precisión y Limitaciones", content: "Los sistemas de IA pueden interpretar documentos incorrectamente, especialmente escaneos de baja calidad, formatos poco comunes o cifras ambiguas. Usted es responsable de verificar cualquier dato antes de utilizarlo para decisiones financieras o contractuales. El producto está diseñado para hacer visible el origen de cada dato extraído." },
      { title: "6. Contenido Generado", content: "Los reportes y resúmenes generados se basan en los datos de su proyecto y en los documentos que usted seleccione. Deben revisarse antes de distribuirse a patrocinadores, clientes o auditores." },
      { title: "7. Supervisión Humana", content: "Las funciones automatizadas incluyen registro de auditoría y son reversibles. Las reglas de automatización requieren activación explícita y pueden desactivarse en cualquier momento." },
      { title: "8. Contacto", content: "Preguntas sobre nuestro uso de IA: legal@flowsyncpm.com." },
    ],
  },
}
