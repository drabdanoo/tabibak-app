import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../config/theme';

// Doctor Screens
import DoctorDashboardScreen from '../screens/doctor/DoctorDashboardScreen';
import DoctorAppointmentsScreen from '../screens/doctor/DoctorAppointmentsScreen';
import PatientDetailsScreen from '../screens/doctor/PatientDetailsScreen';
import EMRScreen from '../screens/doctor/EMRScreen';
import PrescriptionScreen from '../screens/doctor/PrescriptionScreen';
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen';
import DoctorSettingsScreen from '../screens/doctor/DoctorSettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for Doctor
const DoctorTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'Appointments') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Patients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DoctorDashboardScreen} />
      <Tab.Screen name="Appointments" component={DoctorAppointmentsScreen} />
      <Tab.Screen name="Profile" component={DoctorProfileScreen} />
    </Tab.Navigator>
  );
};

// Stack Navigator for Doctor
const DoctorStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DoctorTabs" 
        component={DoctorTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PatientDetails" 
        component={PatientDetailsScreen}
        options={{ 
          title: 'Patient Details',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen 
        name="EMR" 
        component={EMRScreen}
        options={{ 
          title: 'Electronic Medical Record',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen 
        name="Prescription" 
        component={PrescriptionScreen}
        options={{ 
          title: 'Create Prescription',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
      <Stack.Screen 
        name="Settings" 
        component={DoctorSettingsScreen}
        options={{ 
          title: 'Settings',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
    </Stack.Navigator>
  );
};

export default DoctorStack;
